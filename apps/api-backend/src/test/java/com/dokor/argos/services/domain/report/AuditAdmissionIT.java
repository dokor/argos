package com.dokor.argos.services.domain.report;

import org.junit.jupiter.api.Test;
import jakarta.ws.rs.WebApplicationException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real MariaDB/Flyway concurrency, rollback and terminal/deletion trigger validation. */
class AuditAdmissionIT extends MariaDbReportFixture {
    private int pending() throws Exception {
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT pending FROM ARG_AUDIT_ADMISSION WHERE id=1")) {assertTrue(r.next());return r.getInt(1);}
    }
    @Test void atomicAdmissionCapsTheQueueAndTerminalTransitionsReleaseCapacity() throws Exception {
        sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE status IN ('QUEUED','RUNNING')");
        assertEquals(0,pending());
        var pool=Executors.newFixedThreadPool(8);
        try {
            List<Callable<Boolean>> jobs=new ArrayList<>();
            for(int i=0;i<112;i++) jobs.add(()->{try{runs.createQueuedRun(1,Instant.now());return true;}
                catch(WebApplicationException full){assertEquals(429,full.getResponse().getStatus());return false;}});
            int accepted=0;for(var result:pool.invokeAll(jobs))if(result.get())accepted++;
            assertEquals(100,accepted);assertEquals(100,pending());
            sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE status='QUEUED' LIMIT 1");assertEquals(99,pending());
            runs.createQueuedRun(1,Instant.now());assertEquals(100,pending());
            sql("DELETE FROM ARG_AUDIT_RUN WHERE status='QUEUED' LIMIT 1");assertEquals(99,pending());
            var transactions=new com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl(source,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT));
            var dao=new com.dokor.argos.db.dao.AuditRunDao(transactions);
            var bad=new com.dokor.argos.db.generated.AuditRun();bad.setAuditId(-1L);bad.setStatus("QUEUED");bad.setCreatedAt(Instant.now());
            assertThrows(RuntimeException.class,()->dao.saveQueued(bad,null));assertEquals(99,pending());
        } finally {pool.shutdownNow();}
    }
}
