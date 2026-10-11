package com.dokor.argos.services.account;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
class UsagePolicyTest {
    @Test void defaultsHaveNoCommercialLimitAndUseUtc() {
        var p=new UsagePolicy(ConfigFactory.empty());
        assertNull(p.limit("FREE"));assertNull(p.limit("PREMIUM"));assertNull(p.limit("NEW_OFFER"));
        assertEquals("UTC",p.zone().getId());
    }
    @Test void calendarBoundaryRespectsTimezoneDstAndYearChange() {
        var p=new UsagePolicy(ConfigFactory.parseString("usage.timezone=Europe/Paris"));
        assertEquals(YearMonth.of(2026,11),p.period(Instant.parse("2026-10-31T23:00:00Z")));
        assertEquals(Instant.parse("2026-10-31T23:00:00Z"),p.reset(YearMonth.of(2026,10)));
        assertEquals(Instant.parse("2026-12-31T23:00:00Z"),p.reset(YearMonth.of(2026,12)));
        assertEquals(Instant.parse("2026-03-31T22:00:00Z"),p.reset(YearMonth.of(2026,3)));
    }
    @Test void offersHaveIndependentNullableLimitsAndZeroIsValid() {
        var p=new UsagePolicy(ConfigFactory.parseString("usage.offers { FREE.monthly-limit=0, PREMIUM.monthly-limit=12, OTHER.monthly-limit=null }"));
        assertEquals(0L,p.limit("FREE"));assertEquals(12L,p.limit("PREMIUM"));assertNull(p.limit("OTHER"));
    }
    @Test void invalidConfigurationFailsWithoutSilentlyDisablingQuota() {
        assertThrows(Exception.class,()->new UsagePolicy(ConfigFactory.parseString("usage.timezone=invalid")));
        assertThrows(Exception.class,()->new UsagePolicy(ConfigFactory.parseString("usage.offers.FREE.monthly-limit=-1")));
        assertThrows(Exception.class,()->new UsagePolicy(ConfigFactory.parseString("usage.offers.FREE.monthly-limit=1.5")));
        assertThrows(Exception.class,()->new UsagePolicy(ConfigFactory.parseString("usage.offers.bad.monthly-limit=1")));
    }
}
