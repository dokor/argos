package com.dokor.argos.services;

import com.dokor.argos.db.dao.PremiumWaitlistDao;
import com.dokor.argos.db.generated.PremiumWaitlistEntry;
import com.dokor.argos.services.domain.premium.PremiumWaitlistService;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PremiumWaitlistServiceTest {
    private final PremiumWaitlistDao dao = mock(PremiumWaitlistDao.class);
    private final Instant now = Instant.parse("2026-10-16T10:00:00Z");
    private final PremiumWaitlistService service = new PremiumWaitlistService(dao, Clock.fixed(now, ZoneOffset.UTC));
    @Test void requiresExplicitConsentValidEmailAndSupportedLocale() {
        assertFalse(service.subscribe("test@example.com", false, "fr"));
        assertFalse(service.subscribe("test@example.com", null, "fr"));
        assertFalse(service.subscribe("test@example.com", true, "de"));
        for (String email : new String[]{"", "wrong", "a..b@example.com", "a@-example.com", "x".repeat(65)+"@example.com", "a\r\n@example.com"}) assertFalse(service.subscribe(email, true, "fr"));
        assertFalse(service.subscribe(null, true, "fr")); verifyNoInteractions(dao);
    }
    @Test void normalizesAndRecordsConsentWithTwelveCalendarMonthsRetention() {
        assertTrue(service.subscribe(" Synthetic@Example.com ", true, "en"));
        var entry = ArgumentCaptor.forClass(PremiumWaitlistEntry.class); verify(dao).subscribeIfAbsent(entry.capture());
        assertEquals("synthetic@example.com", entry.getValue().getEmail());
        assertEquals("en", entry.getValue().getLocale());
        assertEquals(PremiumWaitlistService.CONSENT_VERSION, entry.getValue().getConsentVersion());
        assertEquals(now, entry.getValue().getCreatedAt());
        assertEquals(Instant.parse("2027-10-16T10:00:00Z"), entry.getValue().getExpiresAt());
        assertFalse(entry.getValue().toString().contains("synthetic"));
    }
    @Test void purgesUsingTheInjectedClock() { service.purge(); verify(dao).purgeExpired(now); }
}
