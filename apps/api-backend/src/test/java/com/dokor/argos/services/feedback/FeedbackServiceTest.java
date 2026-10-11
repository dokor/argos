package com.dokor.argos.services.feedback;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.report.*;
import com.dokor.argos.services.token.TokenService;
import org.junit.jupiter.api.*;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.function.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FeedbackServiceTest {
 private final AccountDao accounts=mock(AccountDao.class);
 private final FeedbackDao dao=mock(FeedbackDao.class);
 private final AccountSessionService sessions=mock(AccountSessionService.class);
 private final AuditReportDao reportDao=mock(AuditReportDao.class);
 private final ReportReadService reports=mock(ReportReadService.class);
 private final Clock clock=Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"),ZoneOffset.UTC);
 private final FeedbackService service=new FeedbackService(accounts,dao,sessions,reportDao,reports,new TokenService(),clock);
 private final Connection connection=mock(Connection.class);
 private final String csrf="c".repeat(43),token="t".repeat(43);
 private AccountSessionService.Context context;
 private FeedbackService.Submission submission(String type,String description,String report,String run,String key) {
  return new FeedbackService.Submission(type,description,null,null,null,null,report,run,key,"");
 }
 @BeforeEach @SuppressWarnings("unchecked") void setup() {
  var user=new AccountUser();user.setId(7L);user.setRole("ADMIN");user.setState("ACTIVE");
  context=new AccountSessionService.Context(user,new AccountSession());
  when(accounts.transaction(any())).thenAnswer(call->((Function<Connection,Object>)call.getArgument(0)).apply(connection));
  when(sessions.with(any(),nullable(String.class),anyBoolean(),anyBoolean(),any())).thenAnswer(call->((BiFunction<AccountSessionService.Context,Connection,Object>)call.getArgument(4)).apply(context,connection));
  when(dao.save(any(),any())).thenAnswer(call->{Feedback row=call.getArgument(0);if(row.getId()==null)row.setId(42L);return row;});
 }
 @Test void validatesBoundedFieldsAndRejectsSpamAndUntrustedReferences() {
  assertEquals("Idea",FeedbackService.validate(submission("SUGGESTION","  Idea  ",null,null,null)).description());
  for(var bad:List.of(submission("OTHER","x",null,null,null),submission("BUG"," ",null,null,null),submission("BUG","x".repeat(4001),null,null,null),submission("BUG","a\u0000b",null,null,null),submission("FALSE_POSITIVE","x",null,null,"http.hsts"),submission("BUG","x",null,null,"http.hsts"),submission("BUG","x",token,"1",null),submission("BUG","x",null,"9223372036854775808",null))) {
   assertThrows(AccountError.class,()->FeedbackService.validate(bad));
  }
  assertThrows(AccountError.class,()->FeedbackService.validate(new FeedbackService.Submission("BUG","x",null,null,null,null,null,null,null,"spam")));
 }
 @Test void anonymousSuggestionStoresOnlySubmittedContextAndReturnsReceipt() {
  var result=service.submit(null,csrf,submission("SUGGESTION","<script>fixture</script>",null,null,null));
  assertEquals(Map.of("accepted",true,"receipt","42"),result);
  var capture=org.mockito.ArgumentCaptor.forClass(Feedback.class);verify(dao).save(capture.capture(),eq(connection));
  assertEquals("OPEN",capture.getValue().getStatus());assertNull(capture.getValue().getRunId());
  assertEquals("<script>fixture</script>",capture.getValue().getDescription());
  verifyNoInteractions(sessions,reportDao,reports);
 }
 @Test void publicFindingRequiresLiveReportAndExactKeyAndDoesNotStoreToken() throws Exception {
  var mapper=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules();
  var report=mapper.readValue("{\"domain\":\"example.com\",\"issues\":[{\"id\":\"http.hsts\"}]}",ReportDto.class);
  when(reports.getByToken(token)).thenReturn(Optional.of(report));
  var entity=new AuditReport();entity.setRunId(3L);when(reportDao.findByTokenHash(any())).thenReturn(Optional.of(entity));
  service.submit(null,csrf,submission("FALSE_POSITIVE","Incorrect on fixture",token,null,"http.hsts"));
  var capture=org.mockito.ArgumentCaptor.forClass(Feedback.class);verify(dao).save(capture.capture(),eq(connection));
  assertEquals(3L,capture.getValue().getRunId());assertEquals("http.hsts",capture.getValue().getFindingKey());
  assertFalse(mapper.writeValueAsString(capture.getValue()).contains(token));
  assertThrows(AccountError.class,()->service.submit(null,csrf,submission("FALSE_POSITIVE","x",token,null,"forged")));
  when(reports.getByToken(token)).thenReturn(Optional.empty());
  assertThrows(AccountError.class,()->service.submit(null,csrf,submission("FALSE_POSITIVE","x",token,null,"http.hsts")));
  verify(dao,times(1)).save(any(),any());
 }
 @Test void privateRunCannotBeUsedAnonymouslyAndCsrfIsRequired() {
  assertThrows(AccountError.class,()->service.submit(null,csrf,submission("FALSE_POSITIVE","x",null,"3","http.hsts")));
  assertThrows(AccountError.class,()->service.submit(null,null,submission("SUGGESTION","x",null,null,null)));
  verifyNoInteractions(dao,reports,reportDao);
 }
 @Test void allAdminEntryPointsRecheckCurrentRole() {
  context.user().setRole("USER");
  assertThrows(AccountError.class,()->service.list("auth",null,null,20,null));
  assertThrows(AccountError.class,()->service.detail("auth",42));
  assertThrows(AccountError.class,()->service.treat("auth",csrf,42,new FeedbackService.Treatment("CONFIRMED","OPEN")));
  verifyNoInteractions(dao);
 }
 @Test void treatmentIsLockedAuditedAndRejectsConcurrentChanges() {
  var row=new Feedback();row.setId(42L);row.setStatus("OPEN");
  when(dao.get(eq(42L),any(),eq(connection),eq(true))).thenReturn(row);
  assertEquals(Map.of("changed",true),service.treat("auth",csrf,42,new FeedbackService.Treatment("CONFIRMED","OPEN")));
  var event=org.mockito.ArgumentCaptor.forClass(FeedbackEvent.class);verify(dao).event(event.capture(),eq(connection));
  assertEquals(7L,event.getValue().getActorId());assertEquals("OPEN",event.getValue().getOldStatus());assertEquals("CONFIRMED",event.getValue().getNewStatus());
  var error=assertThrows(AccountError.class,()->service.treat("auth",csrf,42,new FeedbackService.Treatment("REJECTED","OPEN")));
  assertEquals(409,error.getResponse().getStatus());
  assertEquals(Map.of("changed",false),service.treat("auth",csrf,42,new FeedbackService.Treatment("CONFIRMED","CONFIRMED")));
  verify(dao,times(1)).event(any(),any());
 }
 @Test void paginationAndRetentionAreBounded() {
  when(dao.list(isNull(),isNull(),eq(20),isNull(),any(),eq(connection))).thenReturn(List.of());
  assertTrue(service.list("auth",null,null,20,null).items().isEmpty());
  assertThrows(AccountError.class,()->service.list("auth",null,null,101,null));
  assertThrows(AccountError.class,()->service.list("auth","forged",null,20,null));
  service.purge();verify(dao).purge(clock.instant().minus(Duration.ofDays(90)),connection);
 }
}
