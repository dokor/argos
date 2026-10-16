package com.dokor.argos.services.connected.discovery;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.dokor.argos.services.domain.domain.DomainService;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.inject.*;

import java.sql.Connection;
import java.time.*;
import java.util.*;

@Singleton
public final class DiscoveryService {
    private final AccountDao accounts;
    private final AccountSessionService sessions;
    private final DiscoveryDao dao;
    private final DomainService domains;
    private final DiscoveryPolicy policy;
    private final DiscoveryTransport transport;
    private final ObjectMapper mapper;
    private final TokenService tokens;
    private final Clock clock;

    @Inject
    public DiscoveryService(
            AccountDao accounts,
            AccountSessionService sessions,
            DiscoveryDao dao,
            DomainService domains,
            DiscoveryPolicy policy,
            DiscoveryTransport transport,
            ObjectMapper mapper,
            TokenService tokens,
            Clock clock) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.dao = dao;
        this.domains = domains;
        this.policy = policy;
        this.transport = transport;
        this.mapper = mapper;
        this.tokens = tokens;
        this.clock = clock;
    }

    public Discovery create(String auth, String csrf, String key, CreateDiscovery raw) {
        if (key == null
                || !key.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))
            throw new AccountError(400, "idempotency_key_invalid");
        if (raw == null || !raw.hostname().matches("[A-Za-z0-9.-]{1,253}"))
            throw new AccountError(400, "hostname_invalid");
        String host = raw.hostname().toLowerCase(Locale.ROOT);
        try {
            if (!UrlNormalizer.normalizeSyntax("https://" + host).equals("https://" + host))
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new AccountError(400, "hostname_invalid");
        }
        var exclusions = raw.excludedPaths().stream().distinct().sorted().toList();
        if (exclusions.stream()
                .anyMatch(
                        p ->
                                p.contains("?")
                                        || p.contains("#")
                                        || p.contains("\\")
                                        || p.contains("%")
                                        || p.matches("(?s).*[\\x00-\\x20\\x7f].*")
                                        || p.contains("/../")
                                        || p.endsWith("/..")))
            throw new AccountError(400, "exclusions_invalid");
        var input = new CreateDiscovery(host, raw.maxUrls(), raw.maxDepth(), exclusions);
        String json = json(input);
        byte[] fingerprint = tokens.sha256(json);
        return sessions.with(
                auth,
                csrf,
                true,
                true,
                (ctx, c) -> {
                    var previous = dao.byKey(ctx.user().getId(), key, c);
                    if (previous != null) {
                        if (!Arrays.equals(previous.getRequestFingerprint(), fingerprint))
                            throw new AccountError(409, "idempotency_conflict");
                        fresh(previous);
                        return view(previous, c);
                    }
                    policy.validate(input);
                    if (dao.active(ctx.user().getId(), c).size() >= policy.accountQueueLimit)
                        throw new AccountError(429, "discovery_queue_full", 2);
                    try {
                        transport.validate(
                                "https://" + host,
                                new DiscoveryBudget(
                                        Duration.ofSeconds(policy.connectSeconds), () -> false));
                    } catch (DiscoveryStop e) {
                        throw new AccountError(400, "hostname_invalid");
                    }
                    // Existing domain cache is only an identity; no audit is created and no quota
                    // is reserved.
                    var domain = domains.findOrCreate(host);
                    dao.gate(c);
                    if (dao.activeCount(c) >= policy.queueLimit)
                        throw new AccountError(429, "discovery_busy", 2);
                    // Account lock serializes this owner's site writes. Avoid gap locks on
                    // a missing site: different owners can otherwise deadlock on insertion.
                    var q = QAccountSite.table;
                    var site =
                            accounts.transactions
                                    .selectQuery(c)
                                    .select(q)
                                    .from(q)
                                    .where(
                                            q.ownerUserId.eq(ctx.user().getId()),
                                            q.domainId.eq(domain.getId()))
                                    .fetchOne();
                    if (site == null) {
                        site = new AccountSite();
                        site.setOwnerUserId(ctx.user().getId());
                        site.setDomainId(domain.getId());
                        site.setCreatedAt(clock.instant());
                        accounts.save(site, q, c);
                    }
                    var row = new DomainDiscovery();
                    row.setId(dao.nextId());
                    row.setOwnerUserId(ctx.user().getId());
                    row.setSiteId(site.getId());
                    row.setIdempotencyKey(key);
                    row.setRequestFingerprint(fingerprint);
                    row.setParametersJson(json);
                    row.setEffectiveLimitsJson(json(policy.limits(input)));
                    row.setCreatedAt(clock.instant());
                    row.setExpiresAt(clock.instant().plus(Duration.ofHours(24)));
                    dao.insert(row, c);
                    return view(dao.owned(ctx.user().getId(), row.getId(), c, false), c);
                });
    }

    public DiscoveryCapabilities capabilities(String auth) {
        return sessions.with(auth, null, true, false, (ctx, c) -> policy.capabilities());
    }

    public Discovery get(String auth, long id) {
        return sessions.with(
                auth,
                null,
                true,
                false,
                (ctx, c) -> {
                    var row = dao.owned(ctx.user().getId(), id, c, false);
                    fresh(row);
                    return view(row, c);
                });
    }

    public List<Discovery> active(String auth) {
        return sessions.with(
                auth,
                null,
                true,
                false,
                (ctx, c) ->
                        dao.resumable(ctx.user().getId(), clock.instant(), c).stream().map(r -> view(r, c)).toList());
    }

    public Discovery cancel(String auth, String csrf, long id) {
        return sessions.with(
                auth,
                csrf,
                true,
                true,
                (ctx, c) -> {
                    var row = dao.owned(ctx.user().getId(), id, c, true);
                    dao.cancel(row, clock.instant(), c);
                    return view(dao.owned(ctx.user().getId(), id, c, false), c);
                });
    }

    public DiscoveredPages pages(String auth, long id, int limit, long offset, String inclusion) {
        new ConnectedDomainDao.Window(limit, offset);
        if (!Set.of("all", "eligible", "excluded").contains(inclusion))
            throw new AccountError(400, "filter_invalid");
        return sessions.with(
                auth,
                null,
                true,
                false,
                (ctx, c) -> {
                    var row = dao.owned(ctx.user().getId(), id, c, false);
                    fresh(row);
                    var p = QDomainDiscoveryPage.table;
                    var scope = p.discoveryId.eq(id).and(p.ownerUserId.eq(ctx.user().getId()));
                    if (!inclusion.equals("all"))
                        scope = scope.and(p.eligible.eq(inclusion.equals("eligible")));
                    long total =
                            accounts.transactions
                                    .selectQuery(c)
                                    .select(p.id.count())
                                    .from(p)
                                    .where(scope)
                                    .fetchOne();
                    var items =
                            accounts
                                    .transactions
                                    .selectQuery(c)
                                    .select(p)
                                    .from(p)
                                    .where(scope)
                                    .orderBy(p.id.asc())
                                    .limit(limit)
                                    .offset(offset)
                                    .fetch()
                                    .stream()
                                    .map(
                                            v ->
                                                    new DiscoveredPage(
                                                            v.getId().toString(),
                                                            v.getNormalizedUrl(),
                                                            DiscoverySource.valueOf(v.getSource()),
                                                            v.getDepth().longValue(),
                                                            v.getEligible(),
                                                            v.getExclusionReason()))
                                    .toList();
                    return new DiscoveredPages(
                            items, total, (long) limit, offset, clock.instant().toString());
                });
    }

    private void fresh(DomainDiscovery row) {
        if (!row.getExpiresAt().isAfter(clock.instant()))
            throw new AccountError(410, "discovery_expired");
    }

    private Discovery view(DomainDiscovery row, Connection c) {
        var input = read(row.getParametersJson(), CreateDiscovery.class);
        var limits = read(row.getEffectiveLimitsJson(), DiscoveryLimits.class);
        return new Discovery(
                row.getId().toString(),
                row.getSiteId().toString(),
                input.hostname(),
                ExecutionStatus.valueOf(row.getStatus()),
                row.getCreatedAt().toString(),
                row.getFinishedAt() == null ? null : row.getFinishedAt().toString(),
                row.getExpiresAt().toString(),
                limits,
                row.getEligibleCount().longValue(),
                row.getExcludedCount().longValue(),
                row.getTruncated(),
                row.getCancelRequested(),
                row.getStopReason(),
                row.getVersion());
    }

    public <T> T read(String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (Exception e) {
            throw new IllegalStateException("Discovery snapshot invalid", e);
        }
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Discovery serialization failed", e);
        }
    }
}
