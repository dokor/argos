package com.dokor.argos.services.analytics;

import com.dokor.argos.services.security.AdminReadAccess;
import com.typesafe.config.ConfigFactory;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.*;

class AccountJourneyServiceTest {
    private final AccountJourneyDao dao = mock(AccountJourneyDao.class);
    private final AdminReadAccess access = mock(AdminReadAccess.class);
    private final Instant now = Instant.parse("2026-10-17T10:00:00Z");

    private AccountJourneyService service(boolean enabled) {
        return new AccountJourneyService(ConfigFactory.parseString("product-analytics.enabled=" + enabled),
                dao, access, Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test void disabledMissingConsentAndDuplicateRegistrationOutcomeNeverCollect() {
        service(false).authenticated(2, 1, "google", "en", "Bearer server");
        service(true).authenticated(2, 1, "google", "en", null);
        service(true).record(AccountJourneyEvent.REGISTERED, null, null, "password", "fr", "Bearer server");
        verifyNoInteractions(access, dao);
    }

    @Test void onlyTrustedCredentialAndClosedMethodReachStorage() {
        doThrow(new IllegalStateException()).when(access).require("untrusted");
        service(true).authenticated(2, 1, "google", "en", "untrusted");
        service(true).record(AccountJourneyEvent.REGISTERED, 1L, 1L, "private@example.com", "en", "Bearer server");
        verifyNoInteractions(dao);
        service(true).authenticated(2, 1, "google", "en", "Bearer server");
        verify(dao).record(AccountJourneyEvent.AUTHENTICATED, 2, 1, "google", "en", now);
        verify(dao).record(AccountJourneyEvent.ACTIVITY, 1, 1, "none", "en", now);
    }

    @Test void storageFailureDoesNotFailTheAccountJourney() {
        doThrow(new IllegalStateException("private text")).when(dao).record(any(), anyLong(), anyLong(), any(), any(), any());
        assertDoesNotThrow(() -> service(true).authenticated(2, 1, "github", "fr", "Bearer server"));
    }
}
