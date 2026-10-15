package com.dokor.argos.services.analysis;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MeasurementContractTest {
    @Test void profileAndExactDestinationChangeTheFrozenContractWithoutLeakingUrls() {
        assertEquals(MeasurementContract.fingerprint(null), MeasurementContract.fingerprint(null));
        assertNotEquals(MeasurementContract.fingerprint("profile-a"), MeasurementContract.fingerprint("profile-b"));
        String first = MeasurementContract.scope("https://example.com", "https://example.com/?token=one");
        assertTrue(first.matches("[a-f0-9]{64}"));
        assertNotEquals(first, MeasurementContract.scope("https://example.com", "https://example.com/?token=two"));
        assertNull(MeasurementContract.scope("https://example.com", null));
    }
}
