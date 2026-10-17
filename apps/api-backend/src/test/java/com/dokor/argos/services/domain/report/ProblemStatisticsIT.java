package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.ProblemStatisticsDao;
import com.dokor.argos.services.statistics.*;
import com.fasterxml.jackson.databind.node.*;
import com.querydsl.sql.*;
import java.time.*;
import java.sql.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.dokor.argos.services.statistics.ProblemStatisticsFixture.*;

/** Real migrations, window queries, bounded backfill, transaction rollback and FK retention. */
class ProblemStatisticsIT extends MariaDbReportFixture {
    final Instant now=Instant.parse("2026-10-17T10:00:00Z"), until=Instant.parse("2026-10-17T00:00:00Z"), from=until.minus(Duration.ofDays(90));
    TransactionManagerQuerydsl transactions;
    ProblemStatisticsDao dao;
    @BeforeEach void statistics() throws Exception {
        transactions=new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT)); dao=new ProblemStatisticsDao(transactions);
        sql("DELETE FROM ARG_AUDIT_REPORT");
    }
    void add(long id,long domain,Instant published,ObjectNode report,boolean project) throws Exception {
        sql("INSERT IGNORE INTO ARG_DOMAIN(id,hostname) VALUES("+domain+",'site-"+domain+".example')");
        sql("INSERT IGNORE INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES("+domain+",'https://site-"+domain+".example/path','https://site-"+domain+".example/path',"+domain+")");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status) VALUES("+id+","+domain+",'COMPLETED')");
        try(var c=source.getConnection();var s=c.prepareStatement("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json,created_at,expires_at) VALUES(?,?,?,UNHEX(SHA2(CONCAT('fixture',?),256)),'private.example','https://private.example/secret',?,?,?)")) {
            s.setLong(1,id);s.setLong(2,domain);s.setLong(3,id);s.setLong(4,id);s.setString(5,mapper.writeValueAsString(report));
            var utc=java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
            s.setTimestamp(6,Timestamp.from(published),utc);s.setTimestamp(7,Timestamp.from(until.plus(Duration.ofDays(365))),utc);s.executeUpdate();
        }
        if(project) transactions.execute(c->dao.write(id,ProblemProjection.from(report,POLICY),c));
    }
    ProblemStatistics read(String category) {
        return transactions.executeAndReturn(c->dao.read(c,from,until,now,ReportRetentionPolicy.defaults(),POLICY,category));
    }
    @Test void countsDomainsOnceAndExcludesUnmeasuredControlsFromDenominators() throws Exception {
        for(int i=1;i<=12;i++)add(100+i,i,until.minusSeconds(3600),report(i<=10,i<=2),true);
        for(int i=0;i<15;i++)add(200+i,1,until.minusSeconds(7200+i),report(true,false),true);
        var result=read("security");var csp=result.findings().stream().filter(r->r.key().equals(KEY)).findFirst().orElseThrow();
        assertEquals(27,result.reports()); assertEquals(12,result.retainedDomains()); assertEquals(2,result.partialDomains());
        assertEquals(10,csp.affectedDomains()); assertEquals(12,csp.measuredDomains()); assertEquals(10.0/12,csp.frequency());
        assertTrue(read("seo").findings().isEmpty());
        String json=mapper.writeValueAsString(result);assertFalse(json.contains("private.example"));assertFalse(json.contains("token"));assertFalse(json.contains("url"));
    }
    @Test void newestIncompatibleReportExcludesDomainWithoutFallingBack() throws Exception {
        for(int i=1;i<=11;i++)add(100+i,i,until.minusSeconds(3600),report(true,false),true);
        var old=report(true,false); ((ObjectNode)old.path("scores").path("calculation")).put("scoringFingerprint","old");
        add(300,1,until.minusSeconds(60),old,true);
        var result=read(null);assertEquals(11,result.domains());assertEquals(10,result.retainedDomains());assertEquals(1,result.excludedDomains());
        assertEquals(10,result.findings().getFirst().affectedDomains());
        add(301,2,until.minusSeconds(30),report(true,false),false);
        assertEquals(1,read(null).pendingDomains()); assertTrue(read(null).findings().isEmpty());
    }
    @Test void antiBotAbsenceNeverEntersTheMeasuredDenominator() throws Exception {
        for(int i=1;i<=12;i++) {
            var report=report(true,false);
            if(i>10) {
                ((ObjectNode)report.path("scores").path("coverage")).put("provisional",true);
                for(var check:report.path("scores").path("coverage").path("checks"))
                    if(KEY.equals(check.path("key").asText()))((ObjectNode)check).put("state","BLOCKED_BY_ANTIBOT");
            }
            add(100+i,i,until.minusSeconds(3600),report,true);
        }
        var result=read(null);var csp=result.findings().getFirst();
        assertEquals(12,result.retainedDomains());assertEquals(2,result.partialDomains());
        assertEquals(10,csp.measuredDomains());assertEquals(10,csp.affectedDomains());assertEquals(1,csp.frequency());
    }
    @Test void aggregationReadsNoBlobsOrPrivateSourceFields() throws Exception {
        try(var connection=org.mockito.Mockito.spy(source.getConnection())) {
            dao.read(connection,from,until,now,ReportRetentionPolicy.defaults(),POLICY,null);
            var sql=org.mockito.ArgumentCaptor.forClass(String.class);
            org.mockito.Mockito.verify(connection,org.mockito.Mockito.times(2)).prepareStatement(sql.capture());
            for(String query:sql.getAllValues())for(String field:new String[]{"report_json","result_json","diagnostic_json","token_hash","target_url","hostname"})
                assertFalse(query.contains(field),field);
        }
    }
    @Test void ranksCloseFrequenciesWithoutRoundingThemIntoATie() throws Exception {
        try(var c=source.getConnection();
            var domains=c.prepareStatement("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(?,?)");
            var audits=c.prepareStatement("INSERT INTO ARG_AUDIT(id,domain_id,input_url,normalized_url) VALUES(?,?,?,?)");
            var runs=c.prepareStatement("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status) VALUES(?,?,'COMPLETED')");
            var reports=c.prepareStatement("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json,created_at,expires_at,problem_projection_version,problem_fingerprint,problem_coverage_version,problem_partial) VALUES(?,?,?,UNHEX(SHA2(?,256)),'precision.example','https://precision.example/','{}','2026-10-16 12:00:00','2027-10-17',1,?,?,0)");
            var checks=c.prepareStatement("INSERT INTO ARG_REPORT_PROBLEM_CHECK(report_id,check_key,category,severity) VALUES(?,?,'security',?)")) {
            for(int i=1;i<=201;i++) {
                long id=1000+i;String host="precision-"+i+".example",url="https://"+host+"/";
                domains.setLong(1,id);domains.setString(2,host);domains.addBatch();
                audits.setLong(1,id);audits.setLong(2,id);audits.setString(3,url);audits.setString(4,url);audits.addBatch();
                runs.setLong(1,id);runs.setLong(2,id);runs.addBatch();
                reports.setLong(1,id);reports.setLong(2,id);reports.setLong(3,id);reports.setString(4,Long.toString(id));
                reports.setString(5,POLICY.fingerprint());reports.setString(6,com.dokor.argos.services.analysis.scoring.MeasurementCoverageService.VERSION);reports.addBatch();
                checks.setLong(1,id);
                if(i<=199) {checks.setString(2,KEY);checks.setString(3,i<=100?"important":null);checks.addBatch();}
                checks.setString(2,"http.security.hsts");checks.setString(3,i<=101?"important":null);checks.addBatch();
            }
            domains.executeBatch();audits.executeBatch();runs.executeBatch();reports.executeBatch();checks.executeBatch();
        }
        var findings=read(null).findings();assertEquals(2,findings.size());
        assertEquals(KEY,findings.getFirst().key());
        assertTrue(findings.getFirst().frequency()>findings.getLast().frequency());
        assertTrue(findings.getFirst().affectedDomains()<findings.getLast().affectedDomains());
    }
    @Test void suppressesSmallGroupsAndExcludesCurrentDayAndExpiredReports() throws Exception {
        for(int i=1;i<=9;i++)add(100+i,i,until.minusSeconds(3600),report(true,false),true);
        add(200,20,until.plusSeconds(1),report(true,false),true);
        add(201,21,until.minusSeconds(1),report(true,false),true);sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2026-10-01' WHERE id=201");
        assertEquals(9,read(null).retainedDomains()); assertTrue(read(null).findings().isEmpty());
    }
    @Test void backfillIsBoundedIdempotentAndDoesNotRewriteHistoricalReports() throws Exception {
        for(int i=1;i<=30;i++)add(100+i,i,until.minusSeconds(3600),report(true,false),false);
        sql("UPDATE ARG_AUDIT_REPORT SET report_json='invalid json' WHERE id=101");
        assertEquals(25,dao.backfill(from,now,ReportRetentionPolicy.defaults(),mapper,POLICY));
        assertEquals(5,read(null).pendingDomains());
        assertEquals(5,dao.backfill(from,now,ReportRetentionPolicy.defaults(),mapper,POLICY));
        assertEquals(0,dao.backfill(from,now,ReportRetentionPolicy.defaults(),mapper,POLICY));
        assertEquals(29,read(null).retainedDomains());assertEquals(1,read(null).excludedDomains());
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT report_json FROM ARG_AUDIT_REPORT WHERE id=101")) {r.next();assertEquals("invalid json",r.getString(1));}
    }
    @Test void projectionRollsBackWithPublicationAndIsDeletedWithReport() throws Exception {
        var report=report(true,false);add(100,10,until.minusSeconds(3600),report,false);
        assertThrows(IllegalStateException.class,()->transactions.execute(c->{dao.write(100,ProblemProjection.from(report,POLICY),c);throw new IllegalStateException("fixture rollback");}));
        assertEquals(1,read(null).pendingDomains());
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*) FROM ARG_REPORT_PROBLEM_CHECK")) {r.next();assertEquals(0,r.getLong(1));}
        transactions.execute(c->dao.write(100,ProblemProjection.from(report,POLICY),c));
        sql("DELETE FROM ARG_AUDIT_REPORT WHERE id=100");
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*) FROM ARG_REPORT_PROBLEM_CHECK")) {r.next();assertEquals(0,r.getLong(1));}
    }
}
