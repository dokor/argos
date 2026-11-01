package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.QAccountCiEntitlement;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.typesafe.config.ConfigFactory;
import jakarta.ws.rs.WebApplicationException;
import java.time.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL", matches=".+")
class CiEntitlementIT extends MariaDbReportFixture {
    private TransactionManagerQuerydsl tx;
    private UsageService usage;
    private CiEntitlementService ci;
    private AccountLifecycleIT.MutableClock clock;

    @BeforeEach void setupCi() throws Exception {
        clock = new AccountLifecycleIT.MutableClock();
        clock.now = Instant.parse("2026-10-18T12:00:00Z");
        tx = new TransactionManagerQuerydsl(source, new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT));
        usage = new UsageService(tx, new UsagePolicy(ConfigFactory.parseString("usage.offers.PREMIUM.monthly-limit=3")), clock);
        ci = new CiEntitlementService(new CiPolicy(ConfigFactory.parseString("premium-ci.enabled=true")
            .withFallback(ConfigFactory.load())), usage, clock);
        runs = new AuditRunService(new AuditRunDao(tx, usage), tokens, mapper);
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,offer,created_at) VALUES(10,'ci@example.com','CI','ACTIVE','PREMIUM',NOW())");
    }

    private void grant() throws Exception {
        sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES(10,1,'2027-10-18 12:00:00',NOW())");
    }

    private void assertDenied(CiEntitlementService.Denial reason) {
        var failure = assertThrows(CiEntitlementService.Denied.class,
            () -> tx.executeAndReturn(c -> ci.requireNewAccess(10, c)));
        assertEquals(reason, failure.reason());
    }

    private void admit(int count) {
        tx.executeAndReturn(c -> {
            ci.admitMany(10, count, c);
            for (int n = 0; n < count; n++) runs.createQueuedRun(1, clock.instant(), 10L, c);
            return null;
        });
    }

    private UsageService.Snapshot usage() { return usage.transaction(c -> usage.snapshot(10, "PREMIUM", c)); }

    @Test void explicitGrantAndVerifiedPremiumAreRequiredRegardlessOfRole() throws Exception {
        assertDenied(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE);
        grant();
        for (String role : new String[]{"USER", "ADMIN"}) {
            sql("UPDATE ARG_ACCOUNT_USER SET role='" + role + "' WHERE id=10");
            for (String offer : new String[]{"FREE", "CI"}) {
                sql("UPDATE ARG_ACCOUNT_USER SET offer='" + offer + "' WHERE id=10");
                assertDenied(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE);
            }
            sql("UPDATE ARG_ACCOUNT_USER SET offer='PREMIUM' WHERE id=10");
            for (String state : new String[]{"PENDING", "SUSPENDED", "ARCHIVED"}) {
                sql("UPDATE ARG_ACCOUNT_USER SET state='" + state + "' WHERE id=10");
                assertDenied(CiEntitlementService.Denial.ACCOUNT_INACCESSIBLE);
            }
            sql("UPDATE ARG_ACCOUNT_USER SET state='ACTIVE' WHERE id=10");
            assertEquals(3, tx.executeAndReturn(c -> ci.requireNewAccess(10, c)).activeKeys());
        }
        var q = QAccountCiEntitlement.table;
        var stored = tx.selectQuery().select(q).from(q).fetchOne();
        assertNotNull(stored);
        assertTrue(stored.getCiAccess());
        assertEquals(Instant.parse("2027-10-18T12:00:00Z"), stored.getValidUntil());
        assertNotNull(stored.getUpdatedAt());
    }

    @Test void expiredDisabledOrMissingGrantCannotBeResurrectedByOfferChange() throws Exception {
        grant();
        sql("UPDATE ARG_ACCOUNT_CI_ENTITLEMENT SET ci_access=0 WHERE id=10");
        assertDenied(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE);
        sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id=10");
        sql("UPDATE ARG_ACCOUNT_USER SET offer='PREMIUM' WHERE id=10");
        assertDenied(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE);
        sql("UPDATE ARG_ACCOUNT_CI_ENTITLEMENT SET ci_access=1,valid_until='2026-10-18 12:00:00' WHERE id=10");
        assertDenied(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE);
        assertThrows(java.sql.SQLException.class, () -> sql("DELETE FROM ARG_ACCOUNT_USER WHERE id=10"));
    }

    @Test void deploymentSwitchDoesNotGrantAccessEvenWithValidEntitlement() throws Exception {
        grant();
        var closed = new CiEntitlementService(new CiPolicy(ConfigFactory.load()), usage, clock);
        var failure = assertThrows(CiEntitlementService.Denied.class,
            () -> tx.executeAndReturn(c -> closed.requireNewAccess(10, c)));
        assertEquals(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE, failure.reason());
    }

    @Test void twoMeasurementsUseOneAtomicAdmissionAndKeepReservationsAcrossMonthBoundary() throws Exception {
        grant();
        clock.now = Instant.parse("2026-10-31T23:59:59Z");
        admit(2);
        assertEquals(2, usage().reserved());
        assertThrows(WebApplicationException.class, () -> admit(2));
        assertEquals(2, usage().reserved());
        clock.now = Instant.parse("2026-11-01T00:00:00Z");
        assertEquals(0, usage().used());
        assertEquals(2, usage().reserved());
        sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id=10");
        assertDenied(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE);
        assertEquals(2, usage().reserved(), "Downgrade must not cancel admitted runs");
        assertEquals(2, tx.selectQuery().select(com.dokor.argos.db.generated.QUsageRun.table)
            .from(com.dokor.argos.db.generated.QUsageRun.table).fetch().size());
    }

    @Test void currentReadRejectsDowngradeEvenAfterAnOlderMvccSnapshot() throws Exception {
        grant();
        var observed = new CountDownLatch(1);
        var changed = new CountDownLatch(1);
        try (var pool = Executors.newSingleThreadExecutor()) {
            var admission = pool.submit(() -> tx.executeAndReturn(c -> {
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT offer FROM ARG_ACCOUNT_USER WHERE id=10")) {
                    assertTrue(r.next()); assertEquals("PREMIUM", r.getString(1));
                    observed.countDown(); assertTrue(changed.await(10, TimeUnit.SECONDS));
                } catch (Exception e) { throw new IllegalStateException(e); }
                return ci.requireNewAccess(10, c);
            }));
            assertTrue(observed.await(10, TimeUnit.SECONDS));
            sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id=10");
            changed.countDown();
            var failure = assertThrows(ExecutionException.class, () -> admission.get(15, TimeUnit.SECONDS));
            assertInstanceOf(CiEntitlementService.Denied.class, failure.getCause());
            assertEquals(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE,
                ((CiEntitlementService.Denied) failure.getCause()).reason());
        } finally { changed.countDown(); }
        assertEquals(0, usage().reserved());
    }
}
