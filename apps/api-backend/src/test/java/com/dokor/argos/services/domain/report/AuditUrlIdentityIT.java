package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.google.common.hash.Hashing;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Real MariaDB 11.4, Flyway upgrade, QueryDSL mappings and concurrent inserts. */
class AuditUrlIdentityIT extends MariaDbReportFixture {
    @Test void upgradeReplacesPrefixConstraintAndPreservesHistoricalRowsAndReferences() throws Exception {
        var previous = Flyway.configure().dataSource(source).cleanDisabled(false).target("39").load();
        previous.clean();
        previous.migrate();
        // V1 inherits the database charset; upgrades must also work from legacy latin1.
        sql("ALTER TABLE ARG_AUDIT MODIFY normalized_url TEXT CHARACTER SET latin1 NOT NULL");
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(1,'example.com')");
        String first = "https://example.com/caf\u00e9/" + "a".repeat(300) + "?page=1";
        String second = first.substring(0, first.length() - 1) + "2";
        insert(1, first);
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status) VALUES(1,1,'FAILED')");
        assertEquals(1062, assertThrows(SQLException.class, () -> insert(2, second)).getErrorCode(),
            "Reproduce the original prefix collision before upgrading");

        var latest = Flyway.configure().dataSource(source).load();
        latest.migrate();
        latest.validate();
        assertEquals(0, latest.migrate().migrationsExecuted);

        var audits = dao();
        var preserved = audits.findByNormalizedUrl(first).orElseThrow();
        assertEquals(1L, preserved.getId());
        assertEquals(first, preserved.getInputUrl());
        assertArrayEquals(hash(first), preserved.getNormalizedUrlHash());
        assertEquals(1, scalar("SELECT audit_id FROM ARG_AUDIT_RUN WHERE id=1"));
        assertEquals(0, scalar("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE()"
            + " AND table_name='ARG_AUDIT' AND index_name='uq_audit_normalized_url'"));
        assertEquals(1, scalar("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE()"
            + " AND table_name='ARG_AUDIT' AND index_name='uq_audit_normalized_url_hash'"
            + " AND non_unique=0 AND sub_part IS NULL"));

        // Raw SQL writers get the same full-URL constraint, without providing a hash.
        insert(2, second);
        assertEquals(2L, audits.findByNormalizedUrl(second).orElseThrow().getId());
        assertEquals(1062, assertThrows(SQLException.class, () -> insert(3, first)).getErrorCode());
    }

    @Test void maximumLengthUrlsWithIdenticalPrefixRemainDistinctAndReusable() {
        String prefix = "https://example.com/";
        prefix += "a".repeat(2047 - prefix.length());
        String first = UrlNormalizer.normalizeSyntax(prefix + "1");
        String second = UrlNormalizer.normalizeSyntax(prefix + "2");
        assertEquals(2048, first.length());
        assertEquals(first.substring(0, 255), second.substring(0, 255));
        var audits = dao();
        var left = audits.findOrCreate(candidate(first));
        assertFalse(audits.existsByNormalizedUrl(second));
        var right = audits.findOrCreate(candidate(second));
        assertNotEquals(left.getId(), right.getId());
        assertEquals(left.getId(), audits.findOrCreate(candidate(first)).getId());
        assertEquals(right.getId(), audits.findByNormalizedUrl(second).orElseThrow().getId());
        assertTrue(audits.existsByNormalizedUrl(first));
    }

    @Test void canonicalIdentityPreservesPathAndQueryCaseAndUnicode() {
        var audits = dao();
        var urls = List.of("/Path?Key=Value", "/path?Key=Value", "/Path?Key=value",
            "/caf\u00e9", "/cafe", "/%2F", "/%2f");
        var ids = urls.stream().map(path -> {
            String url = UrlNormalizer.normalizeSyntax("https://example.com" + path);
            assertFalse(audits.existsByNormalizedUrl(url));
            var saved = audits.findOrCreate(candidate(url));
            var loaded = audits.findByNormalizedUrl(url).orElseThrow();
            assertEquals(url, loaded.getNormalizedUrl());
            assertArrayEquals(hash(url), loaded.getNormalizedUrlHash());
            return saved.getId();
        }).toList();
        assertEquals(urls.size(), ids.stream().distinct().count());
        String equivalent = UrlNormalizer.normalizeSyntax("HTTPS://EXAMPLE.COM:443/Path?Key=Value#section");
        assertEquals(ids.getFirst(), audits.findOrCreate(candidate(equivalent)).getId());
    }

    @Test void generatedHashIsReadOnlyAndFollowsUpdatesThroughBothSaveOverloads() throws Exception {
        var audits = dao();
        String first = "https://example.com/before";
        String second = "https://example.com/after";
        var candidate = candidate(first);
        candidate.setNormalizedUrlHash(new byte[32]);
        var saved = audits.save(candidate);
        var loaded = audits.findById(saved.getId());
        assertArrayEquals(hash(first), loaded.getNormalizedUrlHash());
        loaded.setNormalizedUrl(second);
        try (var connection = source.getConnection()) {
            audits.save(loaded, connection);
        }
        assertTrue(audits.findByNormalizedUrl(first).isEmpty());
        assertArrayEquals(hash(second), audits.findByNormalizedUrl(second).orElseThrow().getNormalizedUrlHash());
        audits.save(audits.findById(saved.getId()));
    }

    @Test void hashCollisionNeverAliasesAnExistingAudit() throws Exception {
        String missing = "https://example.com/collision";
        // Force a collision in this disposable schema; SHA-256 collisions are not practical fixtures.
        sql("ALTER TABLE ARG_AUDIT MODIFY normalized_url_hash BINARY(32) GENERATED ALWAYS AS "
            + "(UNHEX(SHA2('https://example.com/collision',256))) PERSISTENT");
        var audits = dao();
        assertTrue(audits.findByNormalizedUrl(missing).isEmpty());
        assertFalse(audits.existsByNormalizedUrl(missing));
        assertThrows(RuntimeException.class, () -> audits.findOrCreate(candidate(missing)));
        assertEquals(1, scalar("SELECT COUNT(*) FROM ARG_AUDIT"));
    }

    @Test void concurrentInsertsShareOnlyTheSameCompleteUrl() throws Exception {
        var barrier = new CyclicBarrier(4);
        var audits = new AuditDao(transactions()) {
            @Override public Audit save(Audit entity) {
                try { barrier.await(10, TimeUnit.SECONDS); }
                catch (Exception e) { throw new AssertionError(e); }
                return super.save(entity);
            }
        };
        String first = "https://example.com/" + "a".repeat(300) + "1";
        String second = first.substring(0, first.length() - 1) + "2";
        try (var pool = Executors.newFixedThreadPool(4)) {
            var a = pool.submit(() -> audits.findOrCreate(candidate(first)).getId());
            var b = pool.submit(() -> audits.findOrCreate(candidate(first)).getId());
            var c = pool.submit(() -> audits.findOrCreate(candidate(second)).getId());
            var d = pool.submit(() -> audits.findOrCreate(candidate(second)).getId());
            assertEquals(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
            assertEquals(c.get(20, TimeUnit.SECONDS), d.get(20, TimeUnit.SECONDS));
            assertNotEquals(a.get(), c.get());
        }
        assertEquals(3, scalar("SELECT COUNT(*) FROM ARG_AUDIT")); // Includes the fixture's audit.
    }

    private TransactionManagerQuerydsl transactions() {
        return new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT));
    }

    private AuditDao dao() { return new AuditDao(transactions()); }

    private Audit candidate(String url) {
        var audit = new Audit();
        audit.setDomainId(1L);
        audit.setInputUrl(url);
        audit.setNormalizedUrl(url);
        audit.setCreatedAt(Instant.now());
        return audit;
    }

    private byte[] hash(String url) {
        return Hashing.sha256().hashString(url, StandardCharsets.UTF_8).asBytes();
    }

    private void insert(long id, String url) throws SQLException {
        try (var c = source.getConnection(); var s = c.prepareStatement(
            "INSERT INTO ARG_AUDIT(id,domain_id,input_url,normalized_url) VALUES(?,1,?,?)")) {
            s.setLong(1, id);
            s.setString(2, url);
            s.setString(3, url);
            s.executeUpdate();
        }
    }

    private int scalar(String query) throws SQLException {
        try (var c = source.getConnection(); var s = c.createStatement(); var rows = s.executeQuery(query)) {
            assertTrue(rows.next());
            return rows.getInt(1);
        }
    }
}
