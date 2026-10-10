package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class ReportRetentionIT extends MariaDbReportFixture {
    private ReportRetentionService service() {
        return new ReportRetentionService(new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT)),ReportRetentionPolicy.defaults());
    }
    private long count(String query) throws Exception {
        try(var c=source.getConnection();var statement=c.createStatement();var result=statement.executeQuery(query)) {
            assertTrue(result.next());return result.getLong(1);
        }
    }
    @Test void purgesOnlyExpiredTerminalPayloadsAndRevokesBothAccessPaths() throws Exception {
        var now=Instant.parse("2026-10-11T00:00:00Z");
        sql("UPDATE ARG_AUDIT_REPORT SET created_at='2026-10-10',expires_at=NULL WHERE id=1");
        sql("UPDATE ARG_AUDIT_REPORT SET created_at='2020-01-01',expires_at=NULL WHERE id=4");
        sql("UPDATE ARG_AUDIT_RUN SET result_json='{}',module_statuses='{}',last_error='synthetic',claim_token='synthetic' WHERE id IN (1,3,4)");
        assertEquals(2,service().purge(now));
        assertEquals(0,service().purge(now));
        assertEquals(1,count("SELECT COUNT(*) FROM ARG_AUDIT_REPORT"));
        assertEquals(5,count("SELECT COUNT(*) FROM ARG_AUDIT_RUN"));
        assertEquals(1,count("SELECT COUNT(*) FROM ARG_AUDIT"));
        assertEquals(1,count("SELECT COUNT(*) FROM ARG_DOMAIN"));
        assertEquals(2,count("SELECT COUNT(*) FROM ARG_AUDIT_RUN WHERE id IN (3,4) AND result_json IS NULL AND module_statuses IS NULL AND last_error IS NULL AND claim_token IS NULL AND report_token_hash IS NULL AND status='COMPLETED' AND audit_id=1"));
        assertEquals(1,count("SELECT COUNT(*) FROM ARG_AUDIT_RUN WHERE id=1 AND result_json IS NOT NULL AND report_token_hash IS NOT NULL"));
        assertTrue(reader.getByToken("synthetic-expired").isEmpty());
        assertTrue(runs.findByReportToken("synthetic-expired").isEmpty());
    }
    @Test void protectsNonterminalRunsEvenWhenPublishedReportIsExpired() throws Exception {
        sql("UPDATE ARG_AUDIT_RUN SET status='RUNNING',result_json='{}' WHERE id=3");
        assertEquals(0,service().purge(Instant.now()));
        assertEquals(3,count("SELECT COUNT(*) FROM ARG_AUDIT_REPORT"));
        assertEquals(1,count("SELECT COUNT(*) FROM ARG_AUDIT_RUN WHERE id=3 AND result_json IS NOT NULL AND report_token_hash IS NOT NULL"));
    }
    @Test void failedDeleteRollsBackPayloadAndCredentialRevocation() throws Exception {
        sql("CREATE TRIGGER retention_fixture_failure BEFORE DELETE ON ARG_AUDIT_REPORT FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic rollback test'");
        sql("UPDATE ARG_AUDIT_RUN SET result_json='{}' WHERE id=3");
        assertThrows(RuntimeException.class,()->service().purge(Instant.now()));
        assertEquals(3,count("SELECT COUNT(*) FROM ARG_AUDIT_REPORT"));
        assertEquals(1,count("SELECT COUNT(*) FROM ARG_AUDIT_RUN WHERE id=3 AND result_json IS NOT NULL AND report_token_hash IS NOT NULL"));
    }
    @Test void usesCalendarYearsForLeapDayAndEarlierExplicitExpiry() throws Exception {
        sql("UPDATE ARG_AUDIT_REPORT SET created_at='2024-02-29',expires_at='2030-01-01' WHERE id=4");
        assertEquals(1,service().purge(Instant.parse("2027-02-27T23:59:59Z"))); // explicit ancient report 3
        assertEquals(1,service().purge(Instant.parse("2027-02-28T00:00:00Z"))); // leap-day default deadline
    }
}
