package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.AuditScope;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class AuditScopeIT extends MariaDbReportFixture {
    @Test void scopeRoundTripsWithAdmissionAndSurvivesWorkerRecovery() throws Exception {
        var scope=new AuditScope("check","html.title");
        var created=runs.createQueuedRun(1,Instant.now(),null,null,scope);
        var stored=runs.getRun(created.run().getId()).orElseThrow();
        assertEquals(scope,mapper.readValue(stored.getExecutionScope(),AuditScope.class));
        var progress=mapper.readTree(stored.getModuleStatuses());
        assertEquals("PENDING",progress.get(0).get("status").asText());
        assertEquals("PENDING",progress.get(1).get("status").asText());
        assertEquals("SKIPPED",progress.get(2).get("status").asText());
        assertTrue(runs.claim(stored.getId()).isPresent());
        runs.resetModuleStatuses(stored.getId());
        var recovered=runs.getRun(stored.getId()).orElseThrow();
        assertEquals(stored.getExecutionScope(),recovered.getExecutionScope());
        assertEquals(stored.getModuleStatuses(),recovered.getModuleStatuses());
        assertNotNull(recovered.getReportTokenHash());
        assertTrue(runs.findByReportToken(created.reportToken()).isPresent());
    }
    @Test void upgradesExistingQueuedRowsWithoutChangingTheirScopeOrToken() throws Exception {
        var old=Flyway.configure().dataSource(source).cleanDisabled(false).target("33").load();old.clean();old.migrate();
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(1,'example.com')");
        sql("INSERT INTO ARG_AUDIT(id,domain_id,input_url,normalized_url) VALUES(1,1,'https://example.com','https://example.com')");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,report_token_hash) VALUES(1,1,'QUEUED',UNHEX(SHA2('existing-fixture',256)))");
        var latest=Flyway.configure().dataSource(source).load();assertEquals(3,latest.migrate().migrationsExecuted);latest.validate();
        var row=runs.getRun(1).orElseThrow();assertNull(row.getExecutionScope());assertEquals("QUEUED",row.getStatus());
        assertTrue(runs.findByReportToken("existing-fixture").isPresent());assertEquals(0,latest.migrate().migrationsExecuted);
    }
}
