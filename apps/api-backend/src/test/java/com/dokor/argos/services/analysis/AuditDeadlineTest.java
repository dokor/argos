package com.dokor.argos.services.analysis;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;

class AuditDeadlineTest {
    @Test void redirectsAndPollsConsumeTheSameMonotoneBudget() {
        var now=new AtomicLong(); var deadline=new AuditDeadline(Duration.ofSeconds(100),now::get);
        try(var scope=deadline.enter()) {
            assertEquals(Duration.ofSeconds(30),AuditDeadline.requestTimeout(Duration.ofSeconds(30)));
            now.set(Duration.ofSeconds(80).toNanos());
            assertEquals(Duration.ofSeconds(20),AuditDeadline.requestTimeout(Duration.ofSeconds(30)));
            var ssl=deadline.child(Duration.ofSeconds(30));
            now.set(Duration.ofSeconds(95).toNanos());
            assertEquals(Duration.ofSeconds(5),ssl.remaining(Duration.ofSeconds(30)));
            now.set(Duration.ofSeconds(100).toNanos());
            assertThrows(AuditDeadline.DeadlineExceeded.class,()->deadline.remaining(Duration.ofSeconds(30)));
        }
        assertNull(AuditDeadline.current());
    }
}
