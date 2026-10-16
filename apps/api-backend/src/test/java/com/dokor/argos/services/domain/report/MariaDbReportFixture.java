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

/** Runs the real Flyway history, backfill and production DAOs on isolated MariaDB. */
@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL", matches=".+")
abstract class MariaDbReportFixture {
    protected static MariaDbDataSource source;
    protected final TokenService tokens = new TokenService();
    protected final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    protected AuditRunService runs;
    protected AuditReportDao reports;
    protected ReportReadService reader;
    protected ReportPublishService publisher;
    @BeforeAll static void connect() throws Exception {
        String url = System.getenv("ARGOS_TEST_CREDENTIALS_URL");
        assertTrue(url.matches("jdbc:mariadb://(?:127\\.0\\.0\\.1|localhost):[0-9]+/argos_credentials_test"), "Isolated fixture database only");
        source = new MariaDbDataSource(url);
        source.setUser(System.getenv("ARGOS_TEST_CREDENTIALS_USER"));
        source.setPassword(System.getenv("ARGOS_TEST_CREDENTIALS_PASSWORD"));
    }
    @BeforeEach void migrateHistoricalRows() throws Exception {
        // Runtime tests seed AFTER every current migration, including the one-time V27 reset.
        var latest = Flyway.configure().dataSource(source).cleanDisabled(false).load();
        latest.clean(); latest.migrate();
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(1,'example.com')");
        sql("INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES(1,'https://example.com','https://example.com',1)");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,report_token_hash) VALUES"
                + "(1,1,'COMPLETED',UNHEX(SHA2('synthetic-existing',256))),"
                + "(2,1,'QUEUED',UNHEX(SHA2('synthetic-pending',256))),"
                + "(3,1,'COMPLETED',UNHEX(SHA2('synthetic-expired',256))),"
                + "(4,1,'COMPLETED',UNHEX(SHA2('synthetic-before-v5',256))),"
                + "(5,1,'FAILED',NULL)");
        sql("UPDATE ARG_AUDIT_RUN SET last_error='LEGACY_REPORT_CREDENTIAL_UNAVAILABLE',finished_at=NOW(3) WHERE id=5");
        sql("UPDATE ARG_AUDIT_ADMISSION SET pending=1 WHERE id=1");
        for (long id : new long[]{1,3,4}) {
            String token = id == 1 ? "synthetic-existing" : id == 3 ? "synthetic-expired" : "synthetic-before-v5";
            try (var c=source.getConnection(); var s=c.prepareStatement(
                    "INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json,expires_at,diagnostic_json,measurement_completeness) VALUES(?,1,?,?,'example.com','https://example.com','{\"domain\":\"example.com\"}',?,?,'UNKNOWN')")) {
                s.setLong(1,id); s.setLong(2,id); s.setBytes(3,tokens.sha256(token));
                s.setTimestamp(4,id == 3 ? Timestamp.from(Instant.EPOCH) : null);
                s.setString(5,mapper.writeValueAsString(com.dokor.argos.services.connected.summary.DiagnosticProjection.unknown()));
                s.executeUpdate();
            }
        }
        initializeServices();
    }
    protected void migrateHistoricalRowsTo(String target) throws Exception {
        var baseline = Flyway.configure().dataSource(source).cleanDisabled(false).target(MigrationVersion.fromVersion("6")).load();
        baseline.clean(); baseline.migrate();
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(1,'example.com')");
        sql("INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES(1,'https://example.com','https://example.com',1)");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,report_token) VALUES(1,1,'COMPLETED','synthetic-existing'),(2,1,'QUEUED','synthetic-pending'),(3,1,'COMPLETED','synthetic-expired'),(4,1,'COMPLETED',NULL),(5,1,'QUEUED',NULL)");
        legacyReport(1,1,"synthetic-existing",false); legacyReport(3,3,"synthetic-expired",true); legacyReport(4,4,"synthetic-before-v5",false);
        var migration = Flyway.configure().dataSource(source);
        if(target != null) migration.target(MigrationVersion.fromVersion(target));
        migration.load().migrate();
        initializeServices();
    }
    private void initializeServices() throws Exception {
        var transactions = new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT));
        reports = new AuditReportDao(transactions);
        runs = new AuditRunService(new AuditRunDao(transactions),tokens,mapper);
        reader = new ReportReadService(reports,tokens,mapper);
        var composer = mock(PublicReportComposer.class); var summary = mock(AiReportSummaryService.class);
        var dto = mapper.readValue("{\"domain\":\"example.com\"}",ReportDto.class);
        when(composer.compose(any())).thenReturn(dto); when(summary.enrich(any())).thenAnswer(call -> call.getArgument(0));
        publisher = new ReportPublishService(transactions,new AuditRunDao(transactions),reports,composer,summary,org.mockito.Mockito.mock(AhrefsDomainRatingClient.class),mapper);
    }
    protected void sql(String text) throws Exception { try(var connection=source.getConnection();var statement=connection.createStatement()){statement.execute(text);} }
    // Historical migration assertions must not select columns introduced after their target version.
    protected boolean historicalRunTokenPresent(String token) throws Exception {
        try(var c=source.getConnection();var s=c.prepareStatement("SELECT id FROM ARG_AUDIT_RUN WHERE report_token_hash=?")) {
            s.setBytes(1,tokens.sha256(token));try(var rows=s.executeQuery()){return rows.next();}
        }
    }
    protected String historicalRunStatus(long id) throws Exception {
        try(var c=source.getConnection();var s=c.prepareStatement("SELECT status FROM ARG_AUDIT_RUN WHERE id=?")) {
            s.setLong(1,id);try(var rows=s.executeQuery()){return rows.next()?rows.getString(1):null;}
        }
    }
    protected java.util.Optional<ReportDto> historicalStoredReport(String token) throws Exception {
        try(var connection=source.getConnection();var statement=connection.prepareStatement("SELECT report_json FROM ARG_AUDIT_REPORT WHERE token_hash=? AND (expires_at IS NULL OR expires_at>NOW(3))")) {
            statement.setBytes(1,tokens.sha256(token));
            try(var rows=statement.executeQuery()){return rows.next()?java.util.Optional.of(mapper.readValue(rows.getString(1),ReportDto.class)):java.util.Optional.empty();}
        }
    }
    protected void legacyReport(long id,long run,String token,boolean expired) throws Exception {
        try(var connection=source.getConnection();var statement=connection.prepareStatement("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,public_token,domain,target_url,report_json,expires_at) VALUES(?,1,?,?,?,'example.com','https://example.com','{\"domain\":\"example.com\"}',?)")) {
            statement.setLong(1,id); statement.setLong(2,run); statement.setBytes(3,tokens.sha256(token)); statement.setString(4,token);
            statement.setTimestamp(5,expired?Timestamp.from(Instant.EPOCH):null); statement.executeUpdate();
        }
    }
}
