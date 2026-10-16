package com.dokor.argos.services.analytics;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class TrafficAnalyticsServiceTest {
 @Test void requiresAdminAndDisabledCollectionDoesNotWrite(){
  var dao=mock(ProductAnalyticsDao.class);var access=mock(com.dokor.argos.webservices.api.audits.AdminReadAccess.class);
  var service=new TrafficAnalyticsService(com.typesafe.config.ConfigFactory.empty(),dao,access,Clock.systemUTC());
  assertFalse(service.count(new TrafficEvent("/","fr","direct",true),"Bearer synthetic"));verify(access).require("Bearer synthetic");verifyNoInteractions(dao);
  var user=new com.dokor.argos.db.generated.AccountUser();user.setState("ACTIVE");user.setRole("USER");
  assertThrows(com.dokor.argos.services.account.AccountError.class,()->service.metrics(7,"day",new com.dokor.argos.services.account.AccountSessionService.Context(user,null)));verifyNoInteractions(dao);
 }
 @Test void closedDimensions(){assertThrows(IllegalArgumentException.class,()->new TrafficEvent("/report/private","fr","direct",true));assertThrows(IllegalArgumentException.class,()->new TrafficEvent("/","fr","private.test",true));}
 @Test void separatesVisitsViewsAndGroupsUtcWithZeroPeriods(){
  var rows=List.of(new ProductAnalyticsDao.TrafficRow("2026-10-01","traffic_page_view","/","fr","search",5),new ProductAnalyticsDao.TrafficRow("2026-10-01","traffic_visit","/","fr","search",2),new ProductAnalyticsDao.TrafficRow("2026-10-02","traffic_page_view","/faq","en","direct",3));
  var result=TrafficAnalyticsService.summarize(rows,LocalDate.parse("2026-10-01"),LocalDate.parse("2026-10-03"),"day",true);
  assertEquals(8,result.views());assertEquals(2,result.visits());assertEquals(3,result.evolution().size());assertEquals(0,result.evolution().getLast().views());assertEquals("/",result.pages().getFirst().value());
  assertEquals(1,TrafficAnalyticsService.summarize(rows,LocalDate.parse("2026-10-01"),LocalDate.parse("2026-10-03"),"month",true).evolution().size());
 }
}
