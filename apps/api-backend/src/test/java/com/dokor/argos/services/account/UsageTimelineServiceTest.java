package com.dokor.argos.services.account;

import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UsageTimelineServiceTest {
    private final AccountSessionService sessions = mock(AccountSessionService.class);
    private final UsageTimelineService service = new UsageTimelineService(sessions,
            new UsagePolicy(ConfigFactory.parseString("usage.timezone=Europe/Paris")),
            Clock.fixed(Instant.parse("2026-10-31T23:30:00Z"), ZoneOffset.UTC));

    @Test void acceptsQuotaZoneCalendarBoundariesAndLeapDays() {
        var range = service.range("DAY", "GLOBAL", "2024-02-28", "2024-03-02", List.of(), null);
        assertEquals(List.of(LocalDate.parse("2024-02-28"), LocalDate.parse("2024-02-29"), LocalDate.parse("2024-03-01"), LocalDate.parse("2024-03-02")), range.boundaries());
        assertEquals(2, service.range("MONTH", "GLOBAL", "2026-11-01", "2026-12-01", List.of(), null).boundaries().size());
        assertEquals(21, service.range("YEAR", "URL", "2007-01-01", "2027-01-01", List.of("9007199254740993"), "site").boundaries().size());
    }

    @Test void rejectsOversizedMisalignedFutureAndForgedRequestsBeforeDatabaseAccess() {
        for (String[] query : List.of(
                new String[]{"DAY", "2024-01-01", "2025-01-02"},
                new String[]{"DAY", "2026-02-30", "2026-03-02"},
                new String[]{"DAY", "2026-11-01", "2026-11-03"},
                new String[]{"MONTH", "2026-01-02", "2026-02-01"},
                new String[]{"YEAR", "2020-02-01", "2027-01-01"},
                new String[]{"YEAR", "2000-01-01", "2027-01-01"})) {
            assertThrows(AccountError.class, () -> service.timeline("auth", query[0], "GLOBAL", query[1], query[2], List.of(), null));
        }
        for (var filters : List.of(List.of("1", "1"), List.of("9223372036854775808"), List.of("1 OR 1=1"))) {
            assertThrows(AccountError.class, () -> service.timeline("auth", "DAY", "URL", "2026-10-01", "2026-11-01", filters, null));
        }
        assertThrows(AccountError.class, () -> service.timeline("auth", "DAY", "GLOBAL", "2026-10-01", "2026-11-01", List.of("1"), null));
        verifyNoInteractions(sessions);
    }
}
