package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.generated.AccountUser;
import com.dokor.argos.services.account.*;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL", matches=".+")
class UsageTimelineIT extends MariaDbReportFixture {
    private UsageTimelineService service;
    @BeforeEach void setupTimeline() throws Exception {
        var sessions = mock(AccountSessionService.class);
        doAnswer(call -> {
            var user = new AccountUser(); user.setId("owner".equals(call.getArgument(0)) ? 10L : 20L);
            BiFunction<AccountSessionService.Context, Connection, ?> work = call.getArgument(4);
            try (var connection = source.getConnection()) { return work.apply(new AccountSessionService.Context(user, null), connection); }
        }).when(sessions).with(anyString(), isNull(), eq(true), eq(false), any());
        service = new UsageTimelineService(sessions, new UsagePolicy(ConfigFactory.parseString("usage.timezone=Europe/Paris")), Clock.fixed(Instant.parse("2026-11-01T12:00:00Z"), ZoneOffset.UTC));
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,offer,created_at) VALUES(10,'timeline@example.com','One','ACTIVE','FREE',NOW()),(20,'other@example.com','Two','ACTIVE','FREE',NOW())");
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(11,'www.example.com'),(12,'sub.example.com')");
        for (int i = 10; i < 18; i++) {
            int domain = i == 10 ? 1 : i == 11 ? 11 : 12;
            String host = i == 10 ? "example.com" : i == 11 ? "www.example.com" : "sub.example.com";
            sql("INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES(" + i + ",'https://" + host + "/" + i + "','https://" + host + "/" + i + "'," + domain + ")");
        }
    }
    private void debit(int run, int audit, int owner, String timestamp, String state) throws Exception {
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,owner_user_id,status) VALUES(" + run + "," + audit + "," + owner + ",'COMPLETED')");
        sql("INSERT INTO ARG_USAGE_RUN(id,user_id,period,state,created_at,counted_at) VALUES(" + run + "," + owner + ",'2026-10','" + state + "','2026-01-01'," + (timestamp == null ? "NULL" : "'" + timestamp + "'") + ")");
    }
    private UsageTimelineService.Timeline read(String dimension, List<String> filters) {
        return service.timeline("owner", "DAY", dimension, "2026-10-24", "2026-10-27", filters, null);
    }
    @Test void preservesEveryDebitAcrossDimensionsAndTopFiveWithoutLeakingForeignTargets() throws Exception {
        for (int i = 10; i < 18; i++) debit(100 + i, i, 10, "2026-10-25 00:30:00", "COUNTED");
        debit(200, 10, 10, "2026-10-25 01:30:00", "COUNTED"); // DST repeated local hour, distinct debit.
        debit(201, 10, 10, null, "RESERVED"); debit(202, 10, 10, null, "RELEASED");
        debit(203, 17, 20, "2026-10-25 01:30:00", "COUNTED");
        for (String dimension : List.of("GLOBAL", "DOMAIN", "URL")) {
            var data = read(dimension, List.of());
            assertEquals(9, data.total()); assertEquals(9, data.series().stream().mapToLong(UsageTimelineService.Series::total).sum());
            assertEquals(9, data.buckets().get(1).total());
            assertEquals(data.total(), data.buckets().stream().mapToLong(UsageTimelineService.Bucket::total).sum());
            data.buckets().forEach(bucket -> assertEquals(bucket.total(), bucket.values().values().stream().mapToLong(Long::longValue).sum()));
        }
        assertEquals(3, read("DOMAIN", List.of()).series().size());
        assertEquals(6, read("URL", List.of()).series().size());
        assertTrue(read("URL", List.of()).series().stream().anyMatch(series -> series.key().equals("other")));
        assertEquals(3, read("URL", List.of("10", "11")).total());
        assertEquals(0, read("URL", List.of("9999")).total());
        var own = service.timeline("other", "DAY", "URL", "2026-10-24", "2026-10-27", List.of("10"), null);
        assertEquals(0, own.total()); assertTrue(own.options().stream().noneMatch(option -> option.key().equals("10")));
        assertNotNull(read("GLOBAL", List.of()).coverageFrom());
    }
    @Test void bucketsByPublicationAtLocalMidnightMonthAndYearRatherThanReservationPeriod() throws Exception {
        debit(301, 10, 10, "2025-12-31 22:59:59.999", "COUNTED");
        debit(302, 10, 10, "2025-12-31 23:00:00", "COUNTED");
        debit(303, 10, 10, "2026-03-29 21:59:59.999", "COUNTED");
        debit(304, 10, 10, "2026-03-29 22:00:00", "COUNTED");
        var daily = service.timeline("owner", "DAY", "GLOBAL", "2026-03-29", "2026-03-31", List.of(), null);
        assertEquals(List.of(1L, 1L), daily.buckets().stream().map(UsageTimelineService.Bucket::total).toList());
        var annual = service.timeline("owner", "YEAR", "GLOBAL", "2025-01-01", "2027-01-01", List.of(), null);
        assertEquals(List.of(1L, 3L), annual.buckets().stream().map(UsageTimelineService.Bucket::total).toList());
        var monthly = service.timeline("owner", "MONTH", "GLOBAL", "2025-12-01", "2026-02-01", List.of(), null);
        assertEquals(List.of(1L, 1L), monthly.buckets().stream().map(UsageTimelineService.Bucket::total).toList());
        debit(305, 10, 10, null, "COUNTED");
        assertEquals(1, read("GLOBAL", List.of()).undatedCredits());
    }
    @Test void boundsHighCardinalityOptionsAndUsesTheHistoricalRangeIndex() throws Exception {
        for (int i = 0; i < 25; i++) {
            int audit = 1000 + i;
            sql("INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES(" + audit + ",'https://example.com/" + audit + "','https://example.com/" + audit + "',1)");
            debit(1000 + i, audit, 10, "2026-10-25 01:30:00", "COUNTED");
        }
        var data = read("URL", List.of());
        assertEquals(25, data.total()); assertEquals(20, data.options().size()); assertTrue(data.moreOptions());
        assertEquals(6, data.series().size());
        var search = service.timeline("owner", "DAY", "URL", "2026-10-24", "2026-10-27", List.of(), "/1024");
        assertEquals(25, search.total()); assertEquals(1, search.options().size());
        try (var connection = source.getConnection(); var statement = connection.createStatement(); var rows = statement.executeQuery("EXPLAIN SELECT id FROM ARG_USAGE_RUN FORCE INDEX(idx_usage_owner_state_counted) WHERE user_id=10 AND state='COUNTED' AND counted_at>='2026-10-01' AND counted_at<'2026-11-01'")) {
            assertTrue(rows.next()); assertEquals("range", rows.getString("type")); assertEquals("idx_usage_owner_state_counted", rows.getString("key"));
        }
    }
}
