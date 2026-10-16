package com.dokor.argos.services.domain.report;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.AccountUser;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.token.TokenService;
import org.junit.jupiter.api.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.function.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportSharingServiceTest {
    Connection connection; ReportSharingService service; ReportReadService reports; TokenService tokens=new TokenService();
    Instant now=Instant.parse("2026-10-15T10:00:00Z"); ReportDto report=new ReportDto("now","example.com","https://example.com/path",null,null,null,List.of(),null,null);
    @SuppressWarnings("unchecked") @BeforeEach void setup() throws Exception {
        connection=DriverManager.getConnection("jdbc:h2:mem:shares-"+UUID.randomUUID()+";MODE=MySQL");
        try(var s=connection.createStatement()) {
            s.execute("CREATE TABLE ARG_AUDIT_RUN(id BIGINT PRIMARY KEY,owner_user_id BIGINT)");
            s.execute("CREATE TABLE ARG_AUDIT_REPORT(run_id BIGINT PRIMARY KEY,share_token_hash BINARY(32),share_expires_at TIMESTAMP(3))");
            s.execute("INSERT INTO ARG_AUDIT_RUN VALUES(1,10),(2,20)");s.execute("INSERT INTO ARG_AUDIT_REPORT(run_id) VALUES(1),(2)");
        }
        var dao=mock(AccountDao.class);var sessions=mock(AccountSessionService.class);reports=mock(ReportReadService.class);
        doAnswer(call->((Function<Connection,?>)call.getArgument(0)).apply(connection)).when(dao).transaction(any());
        doAnswer(call->{String auth=call.getArgument(0);if(auth==null)throw AccountError.unauthorized();
            var user=new AccountUser();user.setId("owner".equals(auth)?10L:20L);
            return ((BiFunction<AccountSessionService.Context,Connection,?>)call.getArgument(4)).apply(new AccountSessionService.Context(user,null),connection);
        }).when(sessions).with(nullable(String.class),nullable(String.class),eq(true),eq(true),any());
        when(reports.getByRunId(1)).thenReturn(Optional.of(report));when(reports.getByToken("original")).thenReturn(Optional.of(report));
        service=new ReportSharingService(dao,sessions,reports,tokens,Clock.fixed(now,ZoneOffset.UTC),new com.dokor.argos.db.dao.ReportSharingDao());
    }
    @AfterEach void close() throws Exception {connection.close();}
    @Test void storesOnlyHashAndRotatesAndRevokesCapability() throws Exception {
        var first=service.create("owner","csrf",1,30);assertEquals(now.plus(Duration.ofDays(30)).toString(),first.expiresAt());
        try(var s=connection.createStatement();var r=s.executeQuery("SELECT share_token_hash FROM ARG_AUDIT_REPORT WHERE run_id=1")){assertTrue(r.next());assertArrayEquals(tokens.sha256(first.token()),r.getBytes(1));}
        assertTrue(service.shared(first.token()).isPresent());
        var second=service.create("owner","csrf",1,7);assertTrue(service.shared(first.token()).isEmpty());assertTrue(service.shared(second.token()).isPresent());
        service.revoke("owner","csrf",1);assertTrue(service.shared(second.token()).isEmpty());
    }
    @Test void doesNotAllowOtherOwnersToCreateOrRevoke() {
        assertThrows(AccountError.class,()->service.create("other","csrf",1,30));assertThrows(AccountError.class,()->service.revoke("other","csrf",1));
        assertThrows(AccountError.class,()->service.create(null,"csrf",1,30));assertThrows(AccountError.class,()->service.create("owner","csrf",1,365));
    }
    @Test void bothShareExpiryAndReportRetentionAreEnforced() throws Exception {
        var link=service.create("owner","csrf",1,0);assertNull(link.expiresAt());
        when(reports.getByRunId(1)).thenReturn(Optional.empty());assertTrue(service.shared(link.token()).isEmpty());
        when(reports.getByRunId(1)).thenReturn(Optional.of(report));
        try(var s=connection.prepareStatement("UPDATE ARG_AUDIT_REPORT SET share_expires_at=?")){s.setTimestamp(1,Timestamp.from(now));s.executeUpdate();}
        assertTrue(service.shared(link.token()).isEmpty());assertTrue(service.shared("invalid").isEmpty());
    }
    @Test void detailsRequireAuthenticationButNotOwnershipOfSharedReport() {
        var link=service.create("owner","csrf",1,7);
        assertThrows(AccountError.class,()->service.details(null,link.token(),true));
        assertEquals(report,service.details("other",link.token(),true));
        service.revoke("owner","csrf",1);assertThrows(AccountError.class,()->service.details("other",link.token(),true));
    }
}
