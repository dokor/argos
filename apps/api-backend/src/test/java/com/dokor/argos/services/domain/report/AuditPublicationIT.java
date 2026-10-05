package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.coreoz.plume.jersey.errors.WsJacksonJsonProvider;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.analysis.AuditProcessorService;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.domain.DomainService;
import com.dokor.argos.webservices.api.audits.*;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.glassfish.grizzly.threadpool.ThreadPoolConfig;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.net.URI;
import java.net.http.*;
import java.sql.Connection;
import java.time.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL", matches=".+")
class AuditPublicationIT extends MariaDbReportFixture {
    private TransactionManagerQuerydsl transactions() {
        return new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT));
    }
    private ReportPublishService publisher(AuditRunDao runDao, AuditReportDao reportDao) throws Exception {
        var composer = mock(PublicReportComposer.class); var summary = mock(AiReportSummaryService.class);
        when(composer.compose(any())).thenReturn(mapper.readValue("{\"domain\":\"example.com\"}", ReportDto.class));
        when(summary.enrich(any())).thenAnswer(call -> call.getArgument(0));
        return new ReportPublishService(transactions(),runDao,reportDao,composer,summary,mapper);
    }
    private Audit audit() { var audit = new Audit(); audit.setId(1L); audit.setNormalizedUrl("https://example.com"); return audit; }
    private com.dokor.argos.services.domain.audit.model.QueuedRun claimedRun() throws Exception {
        var created = runs.createQueuedRun(1,Instant.now());
        assertTrue(new AuditRunDao(transactions()).claimRun(created.run().getId(),"synthetic-worker",Instant.now()));
        return created;
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void failureAfterReportInsertOrRunUpdateRollsBackBothAndRetryKeepsOriginalLink(boolean afterUpdate) throws Exception {
        var created = claimedRun(); long id=created.run().getId();
        var failingRuns = new AuditRunDao(transactions()) {
            @Override public boolean markCompleted(long runId,String claim,Instant now,String json,Connection connection) {
                // Another connection cannot see the uncommitted report or terminal status.
                assertEquals("RUNNING",runs.getRun(runId).orElseThrow().getStatus());
                assertTrue(reader.getByToken(created.reportToken()).isEmpty());
                if (afterUpdate) super.markCompleted(runId,claim,now,json,connection);
                throw new IllegalStateException("Synthetic failure between durable writes");
            }
        };
        assertThrows(IllegalStateException.class, () -> publisher(failingRuns,reports)
            .completeAndPublish(id,audit(),mock(AuditReportJson.class),"{}","synthetic-worker"));
        assertEquals("RUNNING",runs.getRun(id).orElseThrow().getStatus());
        assertNull(runs.getRun(id).orElseThrow().getResultJson());
        assertTrue(reports.findByRunId(id).isEmpty());
        long reportId=publisher.completeAndPublish(id,audit(),mock(AuditReportJson.class),"{}","synthetic-worker");
        assertEquals("COMPLETED",runs.getRun(id).orElseThrow().getStatus());
        assertEquals(reportId,reports.findByRunId(id).orElseThrow().getId());
        assertTrue(reader.getByToken(created.reportToken()).isPresent());
        assertArrayEquals(tokens.sha256(created.reportToken()),reports.findByRunId(id).orElseThrow().getTokenHash());
    }
    @Test void reportInsertFailureNeverCompletesRun() throws Exception {
        var created=claimedRun(); long id=created.run().getId();
        var unavailable = new AuditReportDao(transactions()) {
            @Override public AuditReport save(AuditReport entity,Connection connection) { throw new IllegalStateException("Synthetic DB write failure"); }
        };
        assertThrows(IllegalStateException.class, () -> publisher(new AuditRunDao(transactions()),unavailable)
            .completeAndPublish(id,audit(),mock(AuditReportJson.class),"{}","synthetic-worker"));
        assertEquals("RUNNING",runs.getRun(id).orElseThrow().getStatus());
        assertTrue(reports.findByRunId(id).isEmpty());
        runs.fail(id,"AUDIT_PROCESSING_FAILED","synthetic-worker");
        assertEquals("FAILED",runs.getRun(id).orElseThrow().getStatus());
    }
    @Test void concurrentDuplicatePublicationReturnsOneReportAndLateFailureCannotUndoIt() throws Exception {
        var created=claimedRun(); long id=created.run().getId(); var start=new CyclicBarrier(2);
        try (var pool=Executors.newFixedThreadPool(2)) {
            Callable<Long> publish=() -> { start.await(10,TimeUnit.SECONDS); return publisher.completeAndPublish(id,audit(),mock(AuditReportJson.class),"{}","synthetic-worker"); };
            var first=pool.submit(publish); var second=pool.submit(publish);
            assertEquals(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS));
        }
        runs.fail(id,"late worker error","synthetic-worker");
        assertEquals("COMPLETED",runs.getRun(id).orElseThrow().getStatus());
        assertEquals(1,count("ARG_AUDIT_REPORT WHERE run_id="+id));
    }
    @Test void reclaimedWorkerCannotPublishOrFailNewAttempt() throws Exception {
        var created=claimedRun(); long id=created.run().getId();
        sql("UPDATE ARG_AUDIT_RUN SET claim_token='synthetic-new-worker' WHERE id="+id);
        assertThrows(IllegalStateException.class, () -> publisher.completeAndPublish(id,audit(),mock(AuditReportJson.class),"{}","synthetic-worker"));
        runs.fail(id,"late worker error","synthetic-worker");
        assertEquals("RUNNING",runs.getRun(id).orElseThrow().getStatus());
        assertTrue(reports.findByRunId(id).isEmpty());
    }
    @Test void migrationReconcilesHistoricalCompletedOrphans() throws Exception {
        // Replay V8 from its historical boundary with a credential-bearing orphan.
        sql("DELETE FROM flyway_schema_history WHERE version='8'");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,report_token_hash) VALUES(6,1,'COMPLETED',UNHEX(SHA2('synthetic-orphan',256)))");
        org.flywaydb.core.Flyway.configure().dataSource(source).load().migrate();
        assertEquals("FAILED",runs.getRun(6).orElseThrow().getStatus());
        assertEquals("LEGACY_REPORT_PUBLICATION_MISSING",runs.getRun(6).orElseThrow().getLastError());
        assertTrue(reader.getByToken("synthetic-existing").isPresent());
    }
    @Test void concurrentPublicPostsShareDomainAndAuditButCreateIndependentRuns() throws Exception {
        var domainInsert=new CyclicBarrier(2); var auditInsert=new CyclicBarrier(2);
        var domains=new DomainDao(transactions()) {
            @Override public Domain save(Domain entity) { await(domainInsert); return super.save(entity); }
        };
        var audits=new AuditDao(transactions()) {
            @Override public Audit save(Audit entity) { await(auditInsert); return super.save(entity); }
        };
        var normalizer=mock(UrlNormalizer.class);
        when(normalizer.normalize("https://parallel.example.com")).thenReturn("https://parallel.example.com");
        when(normalizer.extractHostname("https://parallel.example.com")).thenReturn("parallel.example.com");
        var service=new AuditService(audits,runs,mock(AuditProcessorService.class),normalizer,new DomainService(domains),mapper);
        var json=new WsJacksonJsonProvider(); json.setMapper(mapper);
        var resource=new ResourceConfig().register(json).register(new AuditsWs(service,new AdminReadAccess(mock(ConfigurationService.class)),reader));
        var server=GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/api/"),resource,false);
        for (var listener:server.getListeners()) {
            listener.getTransport().setSelectorRunnersCount(1);
            listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4));
        }
        try (var pool=Executors.newFixedThreadPool(2)) {
            server.start();
            var client=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(5)).build();
            var uri=URI.create("http://127.0.0.1:"+server.getListeners().iterator().next().getPort()+"/api/audits");
            Callable<HttpResponse<String>> post=() -> client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20))
                .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString("{\"url\":\"https://parallel.example.com\"}")).build(),HttpResponse.BodyHandlers.ofString());
            var first=pool.submit(post); var second=pool.submit(post);
            var a=first.get(25,TimeUnit.SECONDS); var b=second.get(25,TimeUnit.SECONDS);
            assertEquals(200,a.statusCode(),a.body()); assertEquals(200,b.statusCode(),b.body());
            var left=mapper.readTree(a.body()); var right=mapper.readTree(b.body());
            assertEquals(left.path("auditId"),right.path("auditId"));
            assertNotEquals(left.path("runId"),right.path("runId"));
            assertNotEquals(left.path("reportToken"),right.path("reportToken"));
            assertEquals(1,count("ARG_DOMAIN WHERE hostname='parallel.example.com'"));
            assertEquals(1,count("ARG_AUDIT WHERE normalized_url='https://parallel.example.com'"));
            assertEquals(2,count("ARG_AUDIT_RUN WHERE audit_id="+left.path("auditId").asLong()));
        } finally { server.shutdownNow(); }
    }
    private int count(String tableAndPredicate) throws Exception {
        try(var connection=source.getConnection();var statement=connection.createStatement();var rows=statement.executeQuery("SELECT COUNT(*) FROM "+tableAndPredicate)) { rows.next(); return rows.getInt(1); }
    }
    private static void await(CyclicBarrier barrier) {
        try { barrier.await(10,TimeUnit.SECONDS); } catch(Exception error) { throw new IllegalStateException(error); }
    }
}
