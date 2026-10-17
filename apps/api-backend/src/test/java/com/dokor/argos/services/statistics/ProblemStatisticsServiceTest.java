package com.dokor.argos.services.statistics;

import com.dokor.argos.db.dao.ProblemStatisticsDao;
import com.dokor.argos.db.generated.AccountUser;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.report.ReportRetentionPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.time.*;
import java.util.function.BiFunction;
import org.junit.jupiter.api.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.dokor.argos.services.statistics.ProblemStatisticsFixture.POLICY;

class ProblemStatisticsServiceTest {
    final ProblemStatisticsDao dao=mock(ProblemStatisticsDao.class);
    final AccountSessionService sessions=mock(AccountSessionService.class);
    final Connection connection=mock(Connection.class);
    final AccountUser user=new AccountUser();
    final ReportRetentionPolicy retention=ReportRetentionPolicy.defaults();
    final Instant now=Instant.parse("2026-10-17T10:00:00Z");
    final ProblemStatisticsService service=new ProblemStatisticsService(dao,sessions,POLICY,retention,new ObjectMapper(),Clock.fixed(now,ZoneOffset.UTC));
    @BeforeEach @SuppressWarnings("unchecked") void session() {
        user.setState("ACTIVE");user.setRole("ADMIN");
        doAnswer(call->((BiFunction<AccountSessionService.Context,Connection,Object>)call.getArgument(4))
            .apply(new AccountSessionService.Context(user,null),connection))
            .when(sessions).with(anyString(),isNull(),eq(true),eq(false),any());
    }
    @Test void usesCompleteUtcDaysAndValidatesFilters() {
        service.read("Bearer test",90,null);
        verify(dao).read(connection,Instant.parse("2026-07-19T00:00:00Z"),Instant.parse("2026-10-17T00:00:00Z"),now,retention,POLICY,null);
        service.read("Bearer test",30,"security");
        verify(dao).read(connection,Instant.parse("2026-09-17T00:00:00Z"),Instant.parse("2026-10-17T00:00:00Z"),now,retention,POLICY,"security");
        assertThrows(AccountError.class,()->service.read("Bearer test",7,null));
        assertThrows(AccountError.class,()->service.read("Bearer test",90,"http"));
    }
    @Test void rechecksRoleAndStateBeforeReadingData() {
        user.setRole("USER");assertThrows(AccountError.class,()->service.read("Bearer test",90,null));
        user.setRole("ADMIN");user.setState("SUSPENDED");assertThrows(AccountError.class,()->service.read("Bearer test",90,null));
        verifyNoInteractions(dao);
    }
    @Test void missingOrUnverifiedSessionNeverReadsData() {
        doThrow(AccountError.unauthorized()).when(sessions).with(anyString(),isNull(),eq(true),eq(false),any());
        assertThrows(AccountError.class,()->service.read("Bearer invalid",90,null)); verifyNoInteractions(dao);
    }
}
