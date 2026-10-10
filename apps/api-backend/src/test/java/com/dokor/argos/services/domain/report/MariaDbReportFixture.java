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
    @BeforeEach void migrateHistoricalRows() throws Exception { migrateHistoricalRowsTo(null); }
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
    protected void legacyReport(long id,long run,String token,boolean expired) throws Exception {
        try(var connection=source.getConnection();var statement=connection.prepareStatement("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,public_token,domain,target_url,report_json,expires_at) VALUES(?,1,?,?,?,'example.com','https://example.com','{\"domain\":\"example.com\"}',?)")) {
            statement.setLong(1,id); statement.setLong(2,run); statement.setBytes(3,tokens.sha256(token)); statement.setString(4,token);
            statement.setTimestamp(5,expired?Timestamp.from(Instant.EPOCH):null); statement.executeUpdate();
        }
    }
}
