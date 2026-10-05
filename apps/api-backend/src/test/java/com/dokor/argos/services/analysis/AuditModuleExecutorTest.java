package com.dokor.argos.services.analysis;

import org.junit.jupiter.api.Test;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class AuditModuleExecutorTest {
    @Test void timeoutInterruptsUnderlyingCallAndTheNextRunCanUseTheSameWorker() throws Exception {
        var stopped=new CountDownLatch(1);
        try(var executor=new AuditModuleExecutor(Duration.ofSeconds(2))) {
            assertThrows(HttpTimeoutException.class,()->executor.execute(executor.deadline(),()-> {
                assertNotNull(AuditDeadline.current());
                try { new CountDownLatch(1).await(); return "late"; } finally { stopped.countDown(); }
            }));
            assertTrue(stopped.await(2,TimeUnit.SECONDS));
            assertEquals("next",executor.execute(executor.deadline(),()->"next"));
        }
    }
    @Test void expiredBudgetNeverStartsAnotherModule() {
        var now=new java.util.concurrent.atomic.AtomicLong();
        var deadline=new AuditDeadline(Duration.ofSeconds(1),now::get); now.set(Duration.ofSeconds(2).toNanos());
        try(var executor=new AuditModuleExecutor(Duration.ofSeconds(1))) {
            assertThrows(HttpTimeoutException.class,()->executor.execute(deadline,()->fail("Expired work ran")));
        }
    }
}
