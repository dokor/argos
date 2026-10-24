package com.dokor.argos.services.scheduler;

import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AuditQueuePolicyTest {
    @Test void priorityStaysClosedUntilExplicitAcceptanceConfiguration() {
        var policy = new AuditQueuePolicy(ConfigFactory.load());
        assertFalse(policy.premiumPriorityEnabled); assertEquals(120, policy.agingSeconds);
        assertFalse(new AuditQueuePolicy(ConfigFactory.empty()).premiumPriorityEnabled);
        assertTrue(new AuditQueuePolicy(ConfigFactory.parseString("audit.queue.premium-priority-enabled=true")).premiumPriorityEnabled);
    }
    @Test void agingIsBoundedAndMustBeAnInteger() {
        for (String value : new String[]{"0", "-1", "9", "3601", "120.5"})
            assertThrows(IllegalArgumentException.class, () -> new AuditQueuePolicy(
                ConfigFactory.parseString("audit.queue.priority-aging-seconds=" + value)));
    }
}
