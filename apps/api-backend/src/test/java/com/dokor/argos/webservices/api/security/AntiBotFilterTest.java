package com.dokor.argos.webservices.api.security;
import com.dokor.argos.services.security.AntiBotService;
import com.dokor.argos.services.account.*;
import com.dokor.argos.webservices.api.account.AccountAuthWs;
import com.dokor.argos.webservices.api.audits.AuditsWs;
import com.dokor.argos.webservices.api.feedback.FeedbackWs;
import com.dokor.argos.webservices.api.newsletter.NewsletterWs;
import jakarta.ws.rs.container.*;
import org.junit.jupiter.api.Test;
import java.lang.reflect.Method;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class AntiBotFilterTest {
 private Method method(Class<?> type,String name) {return Arrays.stream(type.getMethods()).filter(m->m.getName().equals(name)&&m.isAnnotationPresent(AntiBot.class)).findFirst().orElseThrow();}
 @Test void allPublicResourcesRequireProofRegardlessOfUriSpelling() {
  var service=mock(AntiBotService.class);when(service.enabled()).thenReturn(true);var sessions=mock(AccountSessionService.class);var info=mock(ResourceInfo.class);var request=mock(ContainerRequestContext.class);
  var filter=new AntiBotFilter(service,sessions,info);
  for(var entry:Map.of("register",AccountAuthWs.class,"forgot",AccountAuthWs.class,"resend",AccountAuthWs.class,"createAudit",AuditsWs.class,"submit",FeedbackWs.class,"subscribe",NewsletterWs.class).entrySet()) {
   var method=method(entry.getValue(),entry.getKey());when(info.getResourceMethod()).thenReturn(method);
   filter.filter(request);verify(service).require(null,method.getAnnotation(AntiBot.class).value());
  }
  verifyNoInteractions(sessions);verify(request,never()).getUriInfo();
  for(String name:List.of("login","reset","verify","confirm","start")) assertTrue(Arrays.stream(AccountAuthWs.class.getMethods()).filter(m->m.getName().equals(name)).noneMatch(m->m.isAnnotationPresent(AntiBot.class)));
 }
 @Test void forgedSessionCannotBypassProofRequirement() {
  var service=mock(AntiBotService.class);when(service.enabled()).thenReturn(true);var sessions=mock(AccountSessionService.class);var info=mock(ResourceInfo.class);
  when(sessions.with(any(),isNull(),eq(false),eq(false),any())).thenThrow(AccountError.unauthorized());
  when(info.getResourceMethod()).thenReturn(method(AuditsWs.class,"createAudit"));var request=mock(ContainerRequestContext.class);when(request.getHeaderString("X-Argos-Account-Session")).thenReturn("forged");
  assertThrows(AccountError.class,()->new AntiBotFilter(service,sessions,info).filter(request));verify(service,never()).require(any(),any());
 }
 @Test void aLiveSessionIsRequiredForAuthenticatedExemption() {
  var service=mock(AntiBotService.class);when(service.enabled()).thenReturn(true);var sessions=mock(AccountSessionService.class);var info=mock(ResourceInfo.class);var request=mock(ContainerRequestContext.class);
  when(info.getResourceMethod()).thenReturn(method(FeedbackWs.class,"submit"));when(request.getHeaderString("Authorization")).thenReturn("Bearer live");
  new AntiBotFilter(service,sessions,info).filter(request);verify(sessions).with(eq("Bearer live"),isNull(),eq(false),eq(false),any());verify(service,never()).require(any(),any());
 }
}
