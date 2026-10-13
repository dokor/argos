package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.connected.ConnectedOwner;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.Connection;
import java.util.List;

/** Private reads only. Admission/worker writes are delivered by F06/F07. */
@Singleton
public final class ConnectedDomainDao {
    public record Window(int limit, long offset) {
        public Window {
            if (limit < 1 || limit > 100 || offset < 0 || offset > 9_007_199_254_740_991L)
                throw new AccountError(400, "payload_invalid");
        }
    }
    public record Slice<T>(List<T> items, long total) {
        public Slice { items = List.copyOf(items); }
    }
    private final TransactionManagerQuerydsl transactions;
    @Inject public ConnectedDomainDao(TransactionManagerQuerydsl transactions) { this.transactions = transactions; }

    public DomainDiscovery discovery(ConnectedOwner owner, long id, Connection c) {
        var t = QDomainDiscovery.table;
        return found(transactions.selectQuery(c).select(t).from(t)
                .where(t.id.eq(id), t.ownerUserId.eq(owner.userId())).fetchOne());
    }

    public DomainBatch batch(ConnectedOwner owner, long siteId, long id, Connection c) {
        var t = QDomainBatch.table;
        return found(transactions.selectQuery(c).select(t).from(t)
                .where(t.id.eq(id), t.siteId.eq(siteId), t.ownerUserId.eq(owner.userId())).fetchOne());
    }

    public DomainDiscoveryPage discoveredPage(ConnectedOwner owner, long discoveryId, long pageId, Connection c) {
        var t = QDomainDiscoveryPage.table;
        return found(transactions.selectQuery(c).select(t).from(t)
                .where(t.id.eq(pageId), t.discoveryId.eq(discoveryId), t.ownerUserId.eq(owner.userId())).fetchOne());
    }

    public DomainBatchPage batchPage(ConnectedOwner owner, long batchId, long pageId, Connection c) {
        var t = QDomainBatchPage.table;
        return found(transactions.selectQuery(c).select(t).from(t)
                .where(t.id.eq(pageId), t.batchId.eq(batchId), t.ownerUserId.eq(owner.userId())).fetchOne());
    }

    public Slice<DomainDiscoveryPage> discoveredPages(ConnectedOwner owner, long discoveryId, Window window, Connection c) {
        discovery(owner, discoveryId, c);
        var t = QDomainDiscoveryPage.table;
        var scope = t.discoveryId.eq(discoveryId).and(t.ownerUserId.eq(owner.userId()));
        long total = transactions.selectQuery(c).select(t.id.count()).from(t).where(scope).fetchOne();
        var rows = transactions.selectQuery(c).select(t).from(t).where(scope)
                .orderBy(t.id.asc()).limit(window.limit()).offset(window.offset()).fetch();
        return new Slice<>(rows, total);
    }

    public Slice<DomainBatch> batches(ConnectedOwner owner, long siteId, Window window, Connection c) {
        var site = QAccountSite.table;
        found(transactions.selectQuery(c).select(site.id).from(site)
                .where(site.id.eq(siteId), site.ownerUserId.eq(owner.userId())).fetchOne());
        var t = QDomainBatch.table;
        var scope = t.siteId.eq(siteId).and(t.ownerUserId.eq(owner.userId()));
        long total = transactions.selectQuery(c).select(t.id.count()).from(t).where(scope).fetchOne();
        var rows = transactions.selectQuery(c).select(t).from(t).where(scope)
                .orderBy(t.createdAt.desc(), t.id.desc()).limit(window.limit()).offset(window.offset()).fetch();
        return new Slice<>(rows, total);
    }

    private static <T> T found(T row) {
        if (row == null) throw AccountError.missing();
        return row;
    }
}
