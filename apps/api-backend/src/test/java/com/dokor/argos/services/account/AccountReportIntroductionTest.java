package com.dokor.argos.services.account;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.domain.report.*;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountReportIntroductionTest {
    AccountSessionService sessions; Connection connection; PreparedStatement query, update; ResultSet row;
    AccountReportIntroductionService service;
    final String token = "f".repeat(43), csrf = "c".repeat(43);
    final Instant now = Instant.parse("2026-10-13T10:00:00Z");
    @BeforeEach void setup() throws Exception {
        sessions = mock(AccountSessionService.class); connection = mock(Connection.class);
        query = mock(PreparedStatement.class); update = mock(PreparedStatement.class); row = mock(ResultSet.class);
        var user = new AccountUser(); user.setId(42L); var session = new AccountSession(); session.setId(7L);
        when(sessions.with(anyString(), nullable(String.class), eq(true), eq(true), any())).thenAnswer(call -> {
            BiFunction<AccountSessionService.Context, Connection, Object> work = call.getArgument(4);
            return work.apply(new AccountSessionService.Context(user, session), connection);
        });
        when(connection.prepareStatement(argThat(sql -> sql != null && sql.startsWith("SELECT")))).thenReturn(query);
        when(connection.prepareStatement(argThat(sql -> sql != null && sql.startsWith("UPDATE")))).thenReturn(update);
        when(query.executeQuery()).thenReturn(row); when(row.next()).thenReturn(true); when(row.getLong(1)).thenReturn(99L);
        when(row.getString(2)).thenReturn("{\"issues\":[{\"id\":\"html.title\"},{\"id\":\"html.h1.count\"}]}");
        when(row.getTimestamp(4)).thenReturn(Timestamp.from(now));
        service = new AccountReportIntroductionService(sessions, new ObjectMapper(), Clock.fixed(now, ZoneOffset.UTC), new TokenService());
    }
    ReportIntroduction input() { return new ReportIntroduction("Provider", "Context", List.of("html.title", "html.h1.count"), "Review together", "forged"); }
    @Test void bindsSessionOwnerAndHashAndUpdatesOnlySeparatePublishedColumn() throws Exception {
        var result = service.publish("Bearer fixture", csrf, token, input());
        assertEquals(now.toString(), result.introduction().publishedAt());
        verify(query).setLong(1, 42L); verify(query).setBytes(eq(2), eq(new TokenService().sha256(token)));
        verify(connection).prepareStatement(argThat(sql -> sql.contains("WHERE r.owner_user_id=? AND p.token_hash=?") && sql.endsWith("FOR UPDATE")));
        verify(connection).prepareStatement("UPDATE ARG_AUDIT_REPORT SET introduction_json=? WHERE id=?");
        verify(update).setLong(2, 99L); verify(update).executeUpdate();
    }
    @Test void inaccessibleOrHistoricallyExpiredRowsCannotBePublished() throws Exception {
        when(row.next()).thenReturn(false);
        assertThrows(AccountError.class, () -> service.publish("Bearer fixture", csrf, token, input()));
        verifyNoInteractions(update);
        when(row.next()).thenReturn(true); when(row.getTimestamp(4)).thenReturn(Timestamp.from(now.minus(Duration.ofDays(1461))));
        assertThrows(AccountError.class, () -> service.publish("Bearer fixture", csrf, token, input()));
        verifyNoInteractions(update);
    }
    @Test void requiresCsrfAndRevokesByNullingOnlyTheIntroduction() throws Exception {
        assertThrows(AccountError.class, () -> service.publish("Bearer fixture", null, token, input()));
        verifyNoInteractions(query, update);
        assertNull(service.revoke("Bearer fixture", csrf, token).introduction());
        verify(update).setString(1, null); verify(update).executeUpdate();
    }
}
