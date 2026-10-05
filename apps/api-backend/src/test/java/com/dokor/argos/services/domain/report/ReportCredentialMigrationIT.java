package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mariadb.jdbc.MariaDbDataSource;
import java.sql.*;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL", matches=".+")
class ReportCredentialMigrationIT extends MariaDbReportFixture {
    @Test void migrationRemovesBothPlaintextColumnsAndPreservesLinks() throws Exception {
        try(var connection=source.getConnection();var statement=connection.createStatement();var rows=statement.executeQuery("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='ARG_AUDIT_RUN' AND column_name='report_token') OR (table_name='ARG_AUDIT_REPORT' AND column_name='public_token'))")) {
            assertTrue(rows.next()); assertEquals(0,rows.getInt(1));
        }
        assertEquals("example.com",reader.getByToken("synthetic-existing").orElseThrow().domain());
        assertTrue(runs.findByReportToken("synthetic-existing").isPresent());
        assertTrue(runs.findByReportToken("synthetic-pending").isPresent());
        assertTrue(runs.findByReportToken("synthetic-before-v5").isPresent());
        assertEquals("FAILED",runs.getRun(5).orElseThrow().getStatus());
    }
    @Test void creationPersistsOnlyHashAndWorkerCanPublishAndRetryWithoutClearToken() throws Exception {
        var created=runs.createQueuedRun(1,Instant.now());
        assertArrayEquals(tokens.sha256(created.reportToken()),created.run().getReportTokenHash());
        sql("UPDATE ARG_AUDIT_RUN SET status='RUNNING', claim_token='synthetic-worker' WHERE id="+created.run().getId());
        var reloaded=runs.getRun(created.run().getId()).orElseThrow();
        var audit=new Audit(); audit.setId(1L);audit.setNormalizedUrl("https://example.com");
        var internal=mock(com.dokor.argos.services.analysis.model.AuditReportJson.class);
        var first=publisher.completeAndPublish(reloaded.getId(),audit,internal,"{}","synthetic-worker");
        assertEquals(first,publisher.completeAndPublish(reloaded.getId(),audit,internal,"{}","synthetic-worker"));
        assertArrayEquals(reloaded.getReportTokenHash(),reports.findByRunId(reloaded.getId()).orElseThrow().getTokenHash());
        assertTrue(reader.getByToken(created.reportToken()).isPresent());
        assertFalse(mapper.writeValueAsString(reloaded).contains(created.reportToken()));
        assertFalse(created.toString().contains(created.reportToken()));
    }
    @Test void unknownAndExpiredTokensDoNotGrantAccess() {
        assertTrue(reader.getByToken("unknown").isEmpty()); assertTrue(runs.findByReportToken("unknown").isEmpty());
        assertTrue(reader.getByToken("synthetic-expired").isEmpty()); assertTrue(reader.isExpired(3));
        assertFalse(reader.isExpired(2));
        var ws=new com.dokor.argos.webservices.api.report.ReportsWs(reader,runs);
        assertEquals(404,ws.getReportStatus("synthetic-expired").getStatus());
        assertEquals(200,ws.getReportStatus("synthetic-pending").getStatus());
    }
}
