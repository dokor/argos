package com.dokor.argos.services.ci;

import com.dokor.argos.services.account.UsageService;
import com.typesafe.config.ConfigFactory;
import java.sql.Connection;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CiEntitlementServiceTest {
    private final UsageService usage = mock(UsageService.class);
    private final CiEntitlementService service = new CiEntitlementService(
        new CiPolicy(ConfigFactory.empty()), usage, Clock.systemUTC());

    @Test void autocommitCannotReleaseTheEntitlementLockBeforeAdmission() throws Exception {
        var c = mock(Connection.class);
        when(c.getAutoCommit()).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.requireNewAccess(10, c));
        verify(c, never()).prepareStatement(anyString());
        verifyNoInteractions(usage);
    }

    @Test void invalidMeasurementCountDoesNotTouchTheLedgerOrAccount() {
        var c = mock(Connection.class);
        for (int invalid : new int[]{-1, 0, 3, Integer.MAX_VALUE})
            assertThrows(IllegalArgumentException.class, () -> service.admitMany(10, invalid, c));
        verifyNoInteractions(c, usage);
    }
}
