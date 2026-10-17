package com.dokor.argos.services.connected.batch;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.ConnectedProfiles;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.connected.discovery.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.inject.*;

import java.net.URI;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;

@Singleton
public final class BatchService {
    private final AccountDao accounts;
    private final AccountSessionService sessions;
    private final BatchDao batches;
    private final DiscoveryDao discoveries;
    private final DiscoveryTransport transport;
    private final AuditDao audits;
    private final AuditRunService runs;
    private final AuditRunDao runDao;
    private final AccountSitesService sites;
    private final ConnectedProfiles profiles;
    private final ObjectMapper mapper;
    private final TokenService tokens;
    private final Clock clock;
    private final BatchQueuePolicy queue;

    @Inject
    public BatchService(
            AccountDao accounts,
            AccountSessionService sessions,
            BatchDao batches,
            DiscoveryDao discoveries,
            DiscoveryTransport transport,
            AuditDao audits,
            AuditRunService runs,
            AuditRunDao runDao,
            AccountSitesService sites,
            ConnectedProfiles profiles,
            ObjectMapper mapper,
            TokenService tokens,
            Clock clock,
            BatchQueuePolicy queue) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.batches = batches;
        this.discoveries = discoveries;
        this.transport = transport;
        this.audits = audits;
        this.runs = runs;
        this.runDao = runDao;
        this.sites = sites;
        this.profiles = profiles;
        this.mapper = mapper;
        this.tokens = tokens;
        this.clock = clock;
        this.queue = queue;
    }

    private <T> T with(
            String auth,
            String csrf,
            boolean mutation,
            BiFunction<AccountSessionService.Context, Connection, T> work) {
        return batches.transaction(
                c -> work.apply(sessions.require(auth, csrf, true, mutation, c), c));
    }

    public record Creation(AdmittedBatch admitted, long ownerId, boolean created) {}

    public AdmittedBatch create(String auth, String csrf, String key, CreateBatch input) {
        return createObserved(auth, csrf, key, input).admitted();
    }

    public Creation createObserved(String auth, String csrf, String key, CreateBatch input) {
        if (key == null
                || !key.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))
            throw new AccountError(400, "idempotency_key_invalid");
        if (input == null) throw new AccountError(400, "selection_invalid");
        var selected = input.selectedPageIds().stream().map(Long::parseLong).sorted().toList();
        var canonical =
                new CreateBatch(
                        input.discoveryId(),
                        selected.stream().map(Object::toString).toList(),
                        input.profileId());
        byte[] fingerprint = tokens.sha256(json(canonical));
        return with(
                auth,
                csrf,
                true,
                (ctx, c) -> {
                    long owner = ctx.user().getId();
                    var previous = batches.byKey(owner, key, c);
                    if (previous != null) {
                        if (!Arrays.equals(previous.getRequestFingerprint(), fingerprint))
                            throw new AccountError(409, "idempotency_conflict");
                        var row = batches.owned(owner, previous.getSiteId(), previous.getId(), c);
                        reconcile(row, c);
                        return new Creation(admitted(row), owner, false);
                    }
                    int pending = 0;
                    for (var current : batches.active(owner, c)) {
                        current = batches.owned(owner, current.getSiteId(), current.getId(), c);
                        reconcile(current, c);
                        if (active(current)) pending++;
                    }
                    if (pending >= queue.accountLimit)
                        throw new AccountError(429, "batch_queue_full", 2);
                    var discovery =
                            discoveries.owned(owner, Long.parseLong(input.discoveryId()), c, false);
                    if (!discovery.getExpiresAt().isAfter(clock.instant()))
                        throw new AccountError(410, "discovery_expired");
                    if (Set.of("QUEUED", "RUNNING").contains(discovery.getStatus()))
                        throw new AccountError(409, "discovery_not_ready");
                    var p = QDomainDiscoveryPage.table;
                    var pages =
                            accounts.transactions
                                    .selectQuery(c)
                                    .select(p)
                                    .from(p)
                                    .where(
                                            p.discoveryId.eq(discovery.getId()),
                                            p.ownerUserId.eq(owner),
                                            p.id.in(selected))
                                    .orderBy(p.id.asc())
                                    .fetch();
                    if (pages.size() != selected.size()) throw AccountError.missing();
                    if (pages.stream().anyMatch(v -> !Boolean.TRUE.equals(v.getEligible())))
                        throw new AccountError(400, "selection_ineligible");
                    var site =
                            accounts.transactions
                                    .selectQuery(c)
                                    .select(QAccountSite.table)
                                    .from(QAccountSite.table)
                                    .where(
                                            QAccountSite.table.id.eq(discovery.getSiteId()),
                                            QAccountSite.table.ownerUserId.eq(owner))
                                    .fetchOne();
                    if (site == null) throw AccountError.missing();
                    String host =
                            accounts.transactions
                                    .selectQuery(c)
                                    .select(QDomain.domain.hostname)
                                    .from(QDomain.domain)
                                    .where(QDomain.domain.id.eq(site.getDomainId()))
                                    .fetchOne();
                    var budget = new DiscoveryBudget(Duration.ofSeconds(5), () -> false);
                    try {
                        for (var page : pages) {
                            String url = UrlNormalizer.normalizeSyntax(page.getNormalizedUrl());
                            if (!url.equals(page.getNormalizedUrl())
                                    || !host.equalsIgnoreCase(URI.create(url).getHost()))
                                throw new DiscoveryStop("TARGET_BLOCKED");
                            transport.validate(url, budget);
                        }
                    } catch (IllegalArgumentException | DiscoveryStop invalid) {
                        throw new AccountError(400, "selection_url_invalid");
                    }
                    var profile = profiles.snapshot(input.profileId());
                    String profileJson = json(profile);
                    // Queue before usage: publication takes run -> queue -> usage. No existing run
                    // is
                    // acquired after the usage lock. All children and reservations share this
                    // transaction.
                    runDao.lockAdmission(c);
                    runDao.usage().admitMany(owner, pages.size(), c);
                    var row = new DomainBatch();
                    row.setId(batches.nextId());
                    row.setOwnerUserId(owner);
                    row.setSiteId(site.getId());
                    row.setDiscoveryId(discovery.getId());
                    row.setIdempotencyKey(key);
                    row.setRequestFingerprint(fingerprint);
                    row.setProfileId(input.profileId());
                    row.setProfileSnapshotJson(profileJson);
                    row.setSelectedCount(pages.size());
                    row.setCreatedAt(clock.instant());
                    batches.insert(row, c);
                    // Shared URL identities may already exist; private relationships/runs never
                    // escape rollback.
                    for (var page : pages) {
                        var candidate = new Audit();
                        candidate.setDomainId(site.getDomainId());
                        candidate.setInputUrl(page.getNormalizedUrl());
                        candidate.setNormalizedUrl(page.getNormalizedUrl());
                        candidate.setCreatedAt(clock.instant());
                        var audit = audits.findOrCreate(candidate);
                        var followed = sites.follow(owner, audit.getId(), c);
                        if (!site.getId().equals(followed.getSiteId()))
                            throw new IllegalStateException("Batch site mismatch");
                        var run =
                                runs.createQueuedRun(audit.getId(), clock.instant(), owner, c)
                                        .run();
                        var q = QAuditRun.auditRun;
                        accounts.transactions
                                .update(q, c)
                                .set(q.profileSnapshot, profileJson)
                                .where(q.id.eq(run.getId()))
                                .execute();
                        batches.child(row, page.getId(), audit.getId(), run.getId(), c);
                    }
                    var stored = batches.owned(owner, site.getId(), row.getId(), c);
                    reconcile(stored, c);
                    return new Creation(admitted(stored), owner, true);
                });
    }

    public BatchProgress get(String auth, long site, long id) {
        return with(
                auth,
                null,
                false,
                (ctx, c) -> view(batches.owned(ctx.user().getId(), site, id, c), c));
    }

    public List<BatchProgress> active(String auth) {
        return with(
                auth,
                null,
                false,
                (ctx, c) -> {
                    var result = new ArrayList<BatchProgress>();
                    for (var row : batches.active(ctx.user().getId(), c)) {
                        row = batches.owned(ctx.user().getId(), row.getSiteId(), row.getId(), c);
                        var progress = view(row, c);
                        if (active(row)) result.add(progress);
                    }
                    return List.copyOf(result);
                });
    }

    public BatchProgress cancel(String auth, String csrf, long site, long id) {
        return with(
                auth,
                csrf,
                true,
                (ctx, c) -> {
                    var row = batches.owned(ctx.user().getId(), site, id, c);
                    var children = batches.pages(row, c, clock.instant());
                    batches.reconcile(row, children, c, clock.instant());
                    if (active(row)) {
                        batches.requestCancel(row, c);
                        for (var child : children)
                            runDao.requestCancellation(
                                    child.runId(), ctx.user().getId(), c, clock.instant());
                    }
                    return view(row, c);
                });
    }

    public BatchProgressPages pages(
            String auth, long site, long id, int limit, long offset, String status) {
        new ConnectedDomainDao.Window(limit, offset);
        if (!Set.of("all", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED").contains(status))
            throw new AccountError(400, "filter_invalid");
        return with(
                auth,
                null,
                false,
                (ctx, c) -> {
                    var row = batches.owned(ctx.user().getId(), site, id, c);
                    var all = batches.pages(row, c, clock.instant());
                    batches.reconcile(row, all, c, clock.instant());
                    var filtered =
                            all.stream()
                                    .filter(p -> status.equals("all") || p.status().equals(status))
                                    .toList();
                    var items =
                            filtered.stream()
                                    .skip(offset)
                                    .limit(limit)
                                    .map(
                                            p ->
                                                    new BatchProgressPage(
                                                            Long.toString(p.id()),
                                                            Long.toString(p.discoveryPageId()),
                                                            Long.toString(p.runId()),
                                                            p.url(),
                                                            ExecutionStatus.valueOf(p.status()),
                                                            Completeness.valueOf(
                                                                    p.status().equals("COMPLETED")
                                                                                    && p.completeness()
                                                                                            .equals(
                                                                                                    "NONE")
                                                                            ? "UNKNOWN"
                                                                            : p.completeness()),
                                                            p.reportAvailable(),
                                                            p.createdAt().toString(),
                                                            p.finishedAt() == null
                                                                    ? null
                                                                    : p.finishedAt().toString()))
                                    .toList();
                    return new BatchProgressPages(
                            items,
                            (long) filtered.size(),
                            (long) limit,
                            offset,
                            clock.instant().toString());
                });
    }

    public void reconcile(long id) {
        batches.transaction(
                c -> {
                    var row = batches.lock(id, c);
                    if (row != null && active(row)) reconcile(row, c);
                    return null;
                });
    }

    private BatchState.Snapshot reconcile(DomainBatch row, Connection c) {
        return batches.reconcile(row, batches.pages(row, c, clock.instant()), c, clock.instant());
    }

    private BatchProgress view(DomainBatch row, Connection c) {
        var state = reconcile(row, c);
        return new BatchProgress(
                row.getId().toString(),
                row.getSiteId().toString(),
                row.getDiscoveryId().toString(),
                batches.hostname(row, c),
                read(row.getProfileSnapshotJson(), ProfileSnapshot.class),
                state.status(),
                row.getCancelRequested(),
                state.counts(),
                state.credits(),
                row.getCreatedAt().toString(),
                row.getFinishedAt() == null ? null : row.getFinishedAt().toString(),
                clock.instant().toString(),
                row.getVersion(),
                path(row));
    }

    private AdmittedBatch admitted(DomainBatch row) {
        return new AdmittedBatch(
                row.getId().toString(),
                row.getSiteId().toString(),
                BatchStatus.valueOf(row.getStatus()),
                row.getSelectedCount().longValue(),
                path(row));
    }

    private static String path(DomainBatch row) {
        return "/account/domains/" + row.getSiteId() + "/batches/" + row.getId();
    }

    private static boolean active(DomainBatch row) {
        return Set.of("QUEUED", "RUNNING").contains(row.getStatus());
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Batch serialization failed", e);
        }
    }

    private <T> T read(String value, Class<T> type) {
        try {
            return mapper.readValue(value, type);
        } catch (Exception e) {
            throw new IllegalStateException("Batch snapshot invalid", e);
        }
    }
}
