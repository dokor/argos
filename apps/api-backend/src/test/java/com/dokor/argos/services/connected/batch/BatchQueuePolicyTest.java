package com.dokor.argos.services.connected.batch;
import static org.junit.jupiter.api.Assertions.*;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;

class BatchQueuePolicyTest {
    @Test void defaultsAreBoundedAndOperatorsCanLowerTheCap() {
        assertEquals(5,new BatchQueuePolicy(ConfigFactory.empty()).accountLimit);
        assertEquals(1,new BatchQueuePolicy(ConfigFactory.parseString("batch.account-queue-limit=1")).accountLimit);
    }
    @Test void invalidCapsFailInitialization() {
        for (String value : new String[]{"0","-1","51","1.5","true"})
            assertThrows(RuntimeException.class,()->new BatchQueuePolicy(ConfigFactory.parseString("batch.account-queue-limit="+value)));
    }
}
