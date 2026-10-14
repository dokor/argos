package com.dokor.argos.services.connected.summary;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.DomainBatch;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.ConnectedOwner;
import com.dokor.argos.services.connected.batch.BatchState;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.inject.*;

import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;
import java.util.stream.Collectors;

@Singleton
public final class DomainSummaryService {
    private final AccountDao accounts;
    private final AccountSessionService sessions;
    private final DomainSummaryDao dao;
    private final ConnectedDomainDao domains;
    private final BatchDao batches;
    private final ObjectMapper mapper;
    private final Clock clock;

    @Inject
    public DomainSummaryService(
            AccountDao accounts,
            AccountSessionService sessions,
            DomainSummaryDao dao,
            ConnectedDomainDao domains,
            BatchDao batches,
            ObjectMapper mapper,
            Clock clock) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.dao = dao;
        this.domains = domains;
        this.batches = batches;
        this.mapper = mapper;
        this.clock = clock;
    }

    private <T> T read(String auth, BiFunction<ConnectedOwner, Connection, T> work) {
        return accounts.transaction(
                c -> {
                    try {
                        c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
                    } catch (java.sql.SQLException e) {
                        throw new IllegalStateException(e);
                    }
                    return work.apply(
                            ConnectedOwner.from(sessions.require(auth, null, true, false, c)), c);
                });
    }

    public Domains list(String auth, int limit, long offset, String term) {
        if (term != null && (term.length() > 253 || term.chars().anyMatch(Character::isISOControl)))
            throw new AccountError(400, "filter_invalid");
        var window = new ConnectedDomainDao.Window(limit, offset);
        return read(
                auth,
                (owner, c) -> {
                    var now = clock.instant();
                    var slice = dao.sites(owner.userId(), window, term == null ? "" : term, c);
                    var ids =
                            slice.items().stream()
                                    .map(DomainSummaryDao.Site::batchId)
                                    .filter(Objects::nonNull)
                                    .toList();
                    var parents =
                            dao.batches(owner.userId(), ids, c).stream()
                                    .collect(Collectors.toMap(DomainBatch::getId, b -> b));
                    var rows = group(dao.pages(owner.userId(), ids, false, now, c));
                    var items =
                            slice.items().stream()
                                    .map(
                                            site -> {
                                                var b = parents.get(site.batchId());
                                                if (b == null)
                                                    return new DomainSummary(
                                                            Long.toString(site.id()),
                                                            site.hostname(),
                                                            null,
                                                            null,
                                                            null,
                                                            new BatchCounts(
                                                                    0L, 0L, 0L, 0L, 0L, 0L, 0L,
                                                                    0L));
                                                var children =
                                                        rows.getOrDefault(b.getId(), List.of());
                                                var state = state(b, children, now);
                                                return new DomainSummary(
                                                        Long.toString(site.id()),
                                                        site.hostname(),
                                                        b.getId().toString(),
                                                        b.getCreatedAt().toString(),
                                                        state.status(),
                                                        DomainSummaryProjection.counts(
                                                                state, children));
                                            })
                                    .toList();
                    return new Domains(items, slice.total(), (long) limit, offset, now.toString());
                });
    }

    public Batches history(String auth, long domain, int limit, long offset) {
        var window = new ConnectedDomainDao.Window(limit, offset);
        return read(
                auth,
                (owner, c) -> {
                    var now = clock.instant();
                    var slice = domains.batches(owner, domain, window, c);
                    var rows =
                            group(
                                    dao.pages(
                                            owner.userId(),
                                            slice.items().stream().map(DomainBatch::getId).toList(),
                                            false,
                                            now,
                                            c));
                    var items =
                            slice.items().stream()
                                    .map(
                                            b -> {
                                                var children =
                                                        rows.getOrDefault(b.getId(), List.of());
                                                var state = state(b, children, now);
                                                return new BatchHistoryItem(
                                                        b.getId().toString(),
                                                        b.getSiteId().toString(),
                                                        parse(
                                                                b.getProfileSnapshotJson(),
                                                                ProfileSnapshot.class),
                                                        b.getCreatedAt().toString(),
                                                        text(state.finishedAt()),
                                                        state.status(),
                                                        b.getCancelRequested(),
                                                        DomainSummaryProjection.counts(
                                                                state, children),
                                                        state.credits(),
                                                        b.getVersion());
                                            })
                                    .toList();
                    return new Batches(items, slice.total(), (long) limit, offset, now.toString());
                });
    }

    private record Detail(
            DomainBatch batch,
            List<DomainSummaryDao.Row> rows,
            BatchState.Snapshot state,
            Instant now) {}

    private <T> T detail(
            String auth, long domain, long id, BiFunction<Detail, Connection, T> work) {
        return batches.transaction(
                c -> {
                    long owner = sessions.require(auth, null, true, false, c).user().getId();
                    var b = batches.owned(owner, domain, id, c);
                    var now = clock.instant();
                    var state = batches.reconcile(b, batches.pages(b, c, now), c, now);
                    var rows = dao.pages(owner, List.of(id), true, now, c);
                    return work.apply(new Detail(b, rows, state, now), c);
                });
    }

    public BatchSummary summary(String auth, long domain, long id) {
        return detail(
                auth,
                domain,
                id,
                (d, c) -> {
                    var b = d.batch();
                    var pages =
                            d.rows().stream()
                                    .map(r -> DomainSummaryProjection.page(r, mapper))
                                    .toList();
                    var discovery = dao.discovery(b.getOwnerUserId(), b.getDiscoveryId(), c);
                    return new BatchSummary(
                            b.getId().toString(),
                            b.getSiteId().toString(),
                            b.getDiscoveryId().toString(),
                            parse(b.getProfileSnapshotJson(), ProfileSnapshot.class),
                            b.getCreatedAt().toString(),
                            text(d.state().finishedAt()),
                            d.state().status(),
                            b.getCancelRequested(),
                            DomainSummaryProjection.counts(d.state(), d.rows()),
                            DomainSummaryProjection.common(pages),
                            pages.stream()
                                    .map(DomainSummaryProjection.Page::result)
                                    .filter(DomainSummaryProjection::priority)
                                    .sorted(DomainSummaryProjection.PRIORITY)
                                    .limit(5)
                                    .toList(),
                            d.state().credits(),
                            d.now().toString(),
                            b.getVersion(),
                            batches.hostname(b, c),
                            new BatchDiscovery(
                                    discovery.getEligibleCount().longValue(),
                                    discovery.getExcludedCount().longValue(),
                                    discovery.getTruncated(),
                                    discovery.getStopReason(),
                                    parse(
                                            discovery.getEffectiveLimitsJson(),
                                            DiscoveryLimits.class)),
                            pages.stream()
                                    .map(DomainSummaryProjection.Page::result)
                                    .filter(DomainSummaryProjection::incomplete)
                                    .sorted(DomainSummaryProjection.URL)
                                    .limit(5)
                                    .toList());
                });
    }

    public BatchPages pages(
            String auth,
            long domain,
            long id,
            int limit,
            long offset,
            DomainSummaryProjection.Filter filter) {
        new ConnectedDomainDao.Window(limit, offset);
        return detail(
                auth,
                domain,
                id,
                (d, c) -> {
                    var results =
                            d.rows().stream()
                                    .map(r -> DomainSummaryProjection.page(r, mapper))
                                    .filter(filter::matches)
                                    .map(DomainSummaryProjection.Page::result)
                                    .sorted(
                                            filter.sort().equals("url")
                                                    ? DomainSummaryProjection.URL
                                                    : DomainSummaryProjection.PRIORITY)
                                    .toList();
                    return new BatchPages(
                            results.stream().skip(offset).limit(limit).toList(),
                            (long) results.size(),
                            (long) limit,
                            offset,
                            d.now().toString());
                });
    }

    private static Map<Long, List<DomainSummaryDao.Row>> group(List<DomainSummaryDao.Row> rows) {
        return rows.stream().collect(Collectors.groupingBy(DomainSummaryDao.Row::batchId));
    }

    private static BatchState.Snapshot state(
            DomainBatch b, List<DomainSummaryDao.Row> rows, Instant now) {
        return BatchState.from(
                rows.stream().map(DomainSummaryDao.Row::state).toList(),
                b.getSelectedCount(),
                b.getCancelRequested(),
                !b.getStatus().equals("QUEUED"),
                now);
    }

    private <T> T parse(String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Stored domain metadata invalid", e);
        }
    }

    private static String text(Instant value) {
        return value == null ? null : value.toString();
    }
}
