package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.ConnectedDomainDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.connected.ConnectedOwner;
import com.querydsl.sql.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Actual MariaDB/Flyway + production QueryDSL reads, using the guarded disposable schema. */
@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL", matches=".+")
class ConnectedModelIT extends MariaDbReportFixture {
    private ConnectedDomainDao connected;
    private TransactionManagerQuerydsl transactions;

    @Override @BeforeEach void migrateHistoricalRows() {
        var flyway = Flyway.configure().dataSource(source).cleanDisabled(false).load();
        flyway.clean();
        flyway.migrate(); // Empty database, not a historical-row backfill fixture.
        transactions = new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT));
        connected = new ConnectedDomainDao(transactions);
    }

    @Test void freshDatabaseHasTheNewModelAndNoSyntheticProductionRecords() throws Exception {
        assertEquals("22", Flyway.configure().dataSource(source).load().info().current().getVersion().toString());
        for (var table : List.of("ARG_ACCOUNT_USER", "ARG_DOMAIN_DISCOVERY", "ARG_DOMAIN_DISCOVERY_PAGE", "ARG_DOMAIN_BATCH", "ARG_DOMAIN_BATCH_PAGE", "ARG_USAGE_RUN")) {
            try (var c = source.getConnection(); var s = c.createStatement(); var r = s.executeQuery("SELECT COUNT(*) FROM " + table)) {
                assertTrue(r.next()); assertEquals(0, r.getLong(1), table);
            }
        }
        for (var q : List.of(QDomainDiscovery.table, QDomainDiscoveryPage.table, QDomainBatch.table, QDomainBatchPage.table, QAuditRun.auditRun)) {
            Set<String> actual = new HashSet<>();
            try (var c = source.getConnection(); var r = c.getMetaData().getColumns(c.getCatalog(), null, q.getTableName(), null)) {
                while (r.next()) actual.add(r.getString("COLUMN_NAME"));
            }
            Set<String> mapped = new HashSet<>();
            q.getColumns().forEach(column -> mapped.add(q.getMetadata(column).getName()));
            assertEquals(actual, mapped, q.getTableName());
        }
    }

    @Test void readsAndTotalsScopeTheOwnerBeforePaginationEvenOnTheSameHostname() throws Exception {
        seed();
        try (var c = source.getConnection()) {
            assertEquals(100L, connected.discovery(owner(10), 100, c).getId());
            assertNotNull(connected.discovery(owner(10), 100, c).getCreatedAt());
            assertEquals("https://example.com/", connected.discoveredPage(owner(10), 100, 110, c).getNormalizedUrl());
            assertEquals(32, connected.discoveredPage(owner(10), 100, 110, c).getNormalizedUrlHash().length);
            assertEquals(1000L, connected.batchPage(owner(10), 120, 130, c).getRunId());
            var page = connected.batches(owner(10), 101, new ConnectedDomainDao.Window(1, 0), c);
            assertEquals(1, page.total()); assertEquals(120L, page.items().getFirst().getId());
            assertTrue(connected.batches(owner(10), 101, new ConnectedDomainDao.Window(1, 1), c).items().isEmpty());
            assertEquals(1, connected.discoveredPages(owner(10), 100, new ConnectedDomainDao.Window(1, 0), c).total());
            missing(() -> connected.discovery(owner(20), 100, c));
            missing(() -> connected.discovery(owner(10), 999, c));
            missing(() -> connected.batch(owner(20), 101, 120, c));
            missing(() -> connected.batch(owner(10), 201, 120, c));
            missing(() -> connected.discoveredPage(owner(20), 100, 110, c));
            missing(() -> connected.batchPage(owner(20), 120, 130, c));
            missing(() -> connected.batches(owner(20), 101, new ConnectedDomainDao.Window(1, 0), c));
            missing(() -> connected.discoveredPages(owner(20), 100, new ConnectedDomainDao.Window(1, 0), c));
        }
    }

    @Test void foreignKeysRejectCrossOwnerCrossDiscoveryAndAnonymousRuns() throws Exception {
        seed();
        rejects("fk_discovery_site_owner", () -> discovery(300, 20, 101, "COMPLETED", "other-site"));
        rejects("fk_batch_discovery_owner", () -> batch(320, 20, 201, 100, "COMPLETED", "other-discovery"));
        batch(121, 10, 101, 100, "COMPLETED", "next-batch");
        rejects("fk_batch_page_context", () -> child(330, 121, 20, 101, 100, 110, 2000));
        rejects("fk_batch_selected_discovery", () -> child(331, 121, 10, 101, 100, 210, 1001));
        rejects("fk_batch_page_run_owner", () -> child(332, 121, 10, 101, 100, 110, 2000));
        rejects("fk_batch_page_run_owner", () -> child(333, 121, 10, 101, 100, 110, 3000));
        // A second batch cannot reattach the same run or rewrite the first batch's history.
        rejects("uq_batch_run", () -> child(334, 121, 10, 101, 100, 110, 1000));
        try (var c = source.getConnection()) { assertEquals(1000L, connected.batchPage(owner(10), 120, 130, c).getRunId()); }
    }

    @Test void identityStatusAndLongUrlConstraintsHoldInMariaDb() throws Exception {
        seed();
        // Idempotency is scoped by owner, with distinct registries per operation type.
        assertThrows(SQLException.class, () -> discovery(101, 10, 101, "COMPLETED", "same-key"));
        assertThrows(SQLException.class, () -> batch(122, 10, 101, 100, "COMPLETED", "same-key"));
        assertThrows(SQLException.class, () -> sql("UPDATE ARG_DOMAIN_BATCH SET status='UNKNOWN' WHERE id=120"));
        assertThrows(SQLException.class, () -> sql("UPDATE ARG_DOMAIN_BATCH SET selected_count=0 WHERE id=120"));
        assertThrows(SQLException.class, () -> sql("UPDATE ARG_DOMAIN_DISCOVERY SET finished_at=NULL WHERE id=100"));
        assertThrows(SQLException.class, () -> sql("UPDATE ARG_DOMAIN_DISCOVERY SET parameters_json='invalid' WHERE id=100"));
        assertThrows(SQLException.class, () -> page(111, 100, 10, 101, "https://example.com/"));
        String prefix="https://example.com/" + "a".repeat(260);
        page(112, 100, 10, 101, prefix + "one");
        page(113, 100, 10, 101, prefix + "two");
        try (var c = source.getConnection()) {
            assertEquals(3, connected.discoveredPages(owner(10), 100, new ConnectedDomainDao.Window(1, 0), c).total());
        }
    }

    @Test void activeOperationSlotsAreAtomicAndReleasedOnlyByTerminalState() throws Exception {
        seed();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            List<Future<Boolean>> results = new ArrayList<>();
            for (long id : List.of(301L, 302L)) results.add(pool.submit(() -> {
                ready.countDown(); assertTrue(start.await(5, TimeUnit.SECONDS));
                try { discovery(id, 10, 101, "QUEUED", "concurrent-" + id); return true; }
                catch (SQLException conflict) { assertEquals("23000", conflict.getSQLState()); return false; }
            }));
            assertTrue(ready.await(5, TimeUnit.SECONDS)); start.countDown();
            int accepted=0;
            for (var result : results) if (result.get(10, TimeUnit.SECONDS)) accepted++;
            assertEquals(1, accepted);
        }
        sql("UPDATE ARG_DOMAIN_DISCOVERY SET status='CANCELED',finished_at='2026-10-13 08:01:00' WHERE active_owner_id=10");
        discovery(303, 10, 101, "QUEUED", "after-cancel");
        batch(321, 10, 101, 100, "RUNNING", "active-batch");
        assertThrows(SQLException.class, () -> batch(322, 10, 101, 100, "QUEUED", "second-active-batch"));
        batch(323, 20, 201, 200, "QUEUED", "other-owner-active-batch");
        sql("UPDATE ARG_DOMAIN_BATCH SET status='PARTIAL',finished_at='2026-10-13 08:01:00' WHERE id=321");
        batch(324, 10, 101, 100, "QUEUED", "after-partial");
    }

    private void seed() throws Exception {
        sql("INSERT INTO ARG_ACCOUNT_USER(id,display_name,state,role,offer,created_at) VALUES(10,'One','ACTIVE','USER','FREE','2026-10-13'),(20,'Two','ACTIVE','USER','FREE','2026-10-13')");
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(1,'example.com')");
        sql("INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES(1,'https://example.com/','https://example.com/',1)");
        sql("INSERT INTO ARG_ACCOUNT_SITE(id,owner_user_id,domain_id,created_at) VALUES(101,10,1,'2026-10-13'),(201,20,1,'2026-10-13')");
        sql("INSERT INTO ARG_ACCOUNT_SITE_URL(id,site_id,audit_id,created_at) VALUES(102,101,1,'2026-10-13'),(202,201,1,'2026-10-13')");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,owner_user_id) VALUES(1000,1,'COMPLETED',10),(1001,1,'COMPLETED',10),(2000,1,'COMPLETED',20),(3000,1,'COMPLETED',NULL)");
        discovery(100,10,101,"COMPLETED","same-key"); discovery(200,20,201,"COMPLETED","same-key");
        page(110,100,10,101,"https://example.com/"); page(210,200,20,201,"https://example.com/");
        batch(120,10,101,100,"COMPLETED","same-key"); batch(220,20,201,200,"COMPLETED","same-key");
        child(130,120,10,101,100,110,1000);
    }

    private void discovery(long id,long owner,long site,String status,String key) throws SQLException {
        execute("INSERT INTO ARG_DOMAIN_DISCOVERY(id,owner_user_id,site_id,idempotency_key,request_fingerprint,status,parameters_json,effective_limits_json,created_at,finished_at,expires_at) VALUES(?,?,?,?,UNHEX(SHA2('fixture',256)),?,'{}','{}','2026-10-13 08:00:00',?,'2026-10-14 08:00:00')",
                id,owner,site,key,status,terminal(status));
    }
    private void page(long id,long discovery,long owner,long site,String url) throws SQLException {
        execute("INSERT INTO ARG_DOMAIN_DISCOVERY_PAGE(id,discovery_id,owner_user_id,site_id,normalized_url,source,depth,eligible) VALUES(?,?,?,?,?,'INITIAL',0,TRUE)",id,discovery,owner,site,url);
    }
    private void batch(long id,long owner,long site,long discovery,String status,String key) throws SQLException {
        execute("INSERT INTO ARG_DOMAIN_BATCH(id,owner_user_id,site_id,discovery_id,idempotency_key,request_fingerprint,profile_id,profile_snapshot_json,selected_count,status,created_at,finished_at) VALUES(?,?,?,?,?,UNHEX(SHA2('fixture',256)),'server-default-v1','{}',1,?,'2026-10-13 08:00:00',?)",
                id,owner,site,discovery,key,status,terminal(status));
    }
    private void child(long id,long batch,long owner,long site,long discovery,long page,long run) throws SQLException {
        execute("INSERT INTO ARG_DOMAIN_BATCH_PAGE(id,batch_id,owner_user_id,site_id,discovery_id,discovery_page_id,audit_id,run_id,created_at) VALUES(?,?,?,?,?,?,1,?,'2026-10-13 08:00:00')",id,batch,owner,site,discovery,page,run);
    }
    private static String terminal(String status) { return Set.of("QUEUED","RUNNING").contains(status) ? null : "2026-10-13 08:00:30"; }
    private void execute(String statement,Object... values) throws SQLException {
        try (var c=source.getConnection(); var s=c.prepareStatement(statement)) {
            for(int i=0;i<values.length;i++) s.setObject(i+1,values[i]);
            s.executeUpdate();
        }
    }
    private static ConnectedOwner owner(long id) {
        var user=new AccountUser(); user.setId(id); user.setState("ACTIVE");
        var session=new AccountSession(); session.setUserId(id);
        return ConnectedOwner.from(new AccountSessionService.Context(user,session));
    }
    private static void missing(Runnable work) {
        var error=assertThrows(AccountError.class,work::run);
        assertEquals(404,error.getResponse().getStatus());
        assertEquals(Map.of("error","resource_unavailable"),error.getResponse().getEntity());
    }
    private static void rejects(String constraint, org.junit.jupiter.api.function.Executable work) {
        var error = assertThrows(SQLException.class, work);
        assertTrue(error.getMessage().contains(constraint), "Expected constraint " + constraint + ": " + error.getMessage());
    }
}
