package com.dokor.argos.services.domain.report;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.services.notifications.NotificationService;
import com.dokor.argos.services.account.AccountError;
import com.querydsl.sql.*;
import org.junit.jupiter.api.*;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
class NotificationsIT extends MariaDbReportFixture {
 NotificationService service;
 @BeforeEach void setup()throws Exception{
  service=new NotificationService(new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT)),Clock.systemUTC());
  sql("INSERT INTO ARG_ACCOUNT_USER(id,display_name,state,created_at) VALUES(10,'A','ACTIVE',NOW(3)),(20,'B','ACTIVE',NOW(3))");
  sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=10 WHERE id IN(1,2)");
 }
 NotificationService.Inbox inbox(long owner)throws Exception{try(var c=source.getConnection()){return service.list(owner,c);}}
 @Test void durableFailureIdempotenceOwnershipCursorAndRetention()throws Exception{
  sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE id=2");sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE id=2");
  var first=inbox(10);assertEquals(1,first.unread());assertEquals("ANALYSIS_FAILED",first.items().getFirst().type());assertEquals(0,inbox(20).unread());
  try(var c=source.getConnection()){assertThrows(AccountError.class,()->service.read(20,Long.parseLong(first.cursor()),false,c));}
  sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE id=1");
  try(var c=source.getConnection()){service.read(10,Long.parseLong(first.cursor()),true,c);service.read(10,Long.parseLong(first.cursor()),false,c);}
  assertEquals(1,inbox(10).unread());assertEquals(2,inbox(10).items().size());
  sql("UPDATE ARG_ACCOUNT_NOTIFICATION SET created_at='2000-01-01'");service.purge();assertEquals(0,inbox(10).items().size());
 }
 @Test void productionOrderPublishesOnlyAfterCompletionAndRollsBackAtomically()throws Exception{
  sql("UPDATE ARG_AUDIT_RUN SET status='RUNNING' WHERE id=2");
  sql("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json,measurement_completeness) VALUES(20,1,2,UNHEX(SHA2('synthetic-ready',256)),'example.com','https://example.com','{}','FULL')");
  assertEquals(0,inbox(10).unread());
  try(var c=source.getConnection()){c.setAutoCommit(false);try(var q=c.createStatement()){q.execute("UPDATE ARG_AUDIT_RUN SET status='COMPLETED' WHERE id=2");}assertEquals(1,service.list(10,c).unread());c.rollback();}
  assertEquals(0,inbox(10).unread());
  sql("UPDATE ARG_AUDIT_RUN SET status='COMPLETED' WHERE id=2");assertEquals("ANALYSIS_READY",inbox(10).items().getFirst().type());
 }
 @Test void publicationRequiredAndPartialTruthful()throws Exception{
  sql("UPDATE ARG_AUDIT_RUN SET status='COMPLETED' WHERE id=2");assertEquals(0,inbox(10).unread());
  sql("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json,measurement_completeness) VALUES(20,1,2,UNHEX(SHA2('synthetic-notification',256)),'example.com','https://example.com','{}','PARTIAL')");
  var item=inbox(10).items().getFirst();assertEquals("ANALYSIS_PARTIAL",item.type());assertEquals("example.com",item.hostname());assertEquals("/account/runs/2",item.href());
  sql("UPDATE ARG_AUDIT_REPORT SET report_json='{}' WHERE id=20");assertEquals(1,inbox(10).items().size());
 }
}
