package com.dokor.argos.services.account;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AccountRunReadDao;
import com.dokor.argos.db.generated.AccountUser;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.*;
import java.sql.Connection;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountRunReadTest {
    private Connection connection;
    private AccountRunReadDao reads;

    @BeforeEach void setup() throws Exception {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:personal-reads-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE");
        connection = source.getConnection();
        // No result_json, last_error, report_token_hash or worker claim columns exist.
        // Selecting the entity instead of the allowlist fails against this schema.
        try (var statement = connection.createStatement()) {
            statement.execute("""
                CREATE TABLE ARG_AUDIT_RUN(id BIGINT PRIMARY KEY,audit_id BIGINT,owner_user_id BIGINT,
                  status VARCHAR(20),created_at TIMESTAMP(3),module_statuses TEXT,
                  started_at TIMESTAMP(3),finished_at TIMESTAMP(3),profile_snapshot TEXT,ci_navigation_origins TEXT)
                """);
            statement.execute("""
                INSERT INTO ARG_AUDIT_RUN(id,audit_id,owner_user_id,status,created_at,module_statuses,started_at,finished_at,profile_snapshot) VALUES
                (1,7,10,'QUEUED','2026-10-16 08:00:00','[]',NULL,NULL,'profile'),
                (2,7,10,'COMPLETED','2026-10-16 08:00:00','[]','2026-10-16 08:01:00','2026-10-16 08:02:00',NULL),
                (3,7,20,'QUEUED','2026-10-16 09:00:00','[]',NULL,NULL,NULL),
                (4,7,NULL,'QUEUED','2026-10-16 09:00:00','[]',NULL,NULL,NULL)
                """);
        }
        try (var statement = connection.prepareStatement("UPDATE ARG_AUDIT_RUN SET finished_at=? WHERE id=2")) {
            statement.setTimestamp(1, java.sql.Timestamp.from(Instant.parse("2026-10-16T08:02:00Z")));
            statement.executeUpdate();
        }
        reads = new AccountRunReadDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
    }

    @AfterEach void close() throws Exception { connection.close(); }
    @Test void privateCiRunsCannotUseTheHistoricalPersonalReader() throws Exception {
        try(var s=connection.createStatement()){s.execute("UPDATE ARG_AUDIT_RUN SET ci_navigation_origins='[\"https://example.com\"]' WHERE id=1");}
        assertEquals(java.util.List.of(2L),reads.list(10,100,connection).stream().map(run->run.getId()).toList());
        assertTrue(reads.owned(1,10,connection).isEmpty());
    }

    @Test void projectsOnlyStatusAndScopesByOwnerEvenForTheSameAudit() {
        var rows = reads.list(10, 100, connection);
        assertEquals(java.util.List.of(2L, 1L), rows.stream().map(r -> r.getId()).toList());
        var run = reads.owned(1, 10, connection).orElseThrow();
        assertEquals(7L, run.getAuditId());
        assertEquals("profile", run.getProfileSnapshot());
        assertNull(run.getStartedAt());
        assertNull(run.getResultJson());
        assertNull(run.getLastError());
        assertNull(run.getReportTokenHash());
        assertNull(run.getClaimToken());
        assertTrue(reads.owned(3, 10, connection).isEmpty());
        assertTrue(reads.owned(4, 10, connection).isEmpty());
        assertTrue(reads.owned(999, 10, connection).isEmpty());
        assertEquals(Instant.parse("2026-10-16T08:02:00Z"), reads.owned(2, 10, connection).orElseThrow().getFinishedAt());
    }

    @Test void boundsListsAndKeepsStableOrdering() throws Exception {
        assertEquals(1, reads.list(10, 0, connection).size());
        assertEquals(2L, reads.list(10, 1, connection).getFirst().getId());
        try (var statement = connection.createStatement()) {
            for (int i = 5; i <= 110; i++) statement.execute("INSERT INTO ARG_AUDIT_RUN(id,audit_id,owner_user_id,status,created_at) VALUES(" + i + ",7,10,'QUEUED','2026-10-16 10:00:00')");
        }
        var rows = reads.list(10, 1000, connection);
        assertEquals(100, rows.size());
        assertEquals(110L, rows.getFirst().getId());
        assertEquals(11L, rows.getLast().getId());
    }

    @SuppressWarnings("unchecked")
    @Test void preservesThePersonalStatusResponseContract() {
        var sessions = mock(AccountSessionService.class);
        doAnswer(call -> {
            var user = new AccountUser(); user.setId(10L);
            return ((BiFunction<AccountSessionService.Context, Connection, ?>) call.getArgument(4))
                .apply(new AccountSessionService.Context(user, null), connection);
        }).when(sessions).with(eq("owner"), isNull(), eq(true), eq(true), any());
        var service = new AccountRunsService(null, sessions, null, null, null, null, null, null, null, reads);
        var result = service.list("owner", 1).getFirst();
        assertEquals(Set.of("runId", "status", "createdAt", "moduleStatuses", "startedAt", "finishedAt", "profileSnapshot"), result.keySet());
        assertEquals("2", result.get("runId"));
        assertEquals("COMPLETED", result.get("status"));
        assertEquals("2026-10-16T08:02:00Z", result.get("finishedAt"));
    }
}
