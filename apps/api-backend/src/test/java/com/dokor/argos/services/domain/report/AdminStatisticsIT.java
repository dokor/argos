package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AdminStatisticsDao;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

/** Real MariaDB aggregation semantics, including migrations and production indexes. */
class AdminStatisticsIT extends MariaDbReportFixture {
    private final AdminStatisticsDao statistics=new AdminStatisticsDao();
    private static final Instant NOW=Instant.parse("2026-10-17T12:00:00Z");

    @Test void accountsIncludeArchivedAndCountDistinctLinkedProvidersWithoutInferringSignup() throws Exception {
        sql("INSERT INTO ARG_ACCOUNT_USER(id,display_name,state,suspended_from,created_at) VALUES"
            +"(101,'Synthetic','ACTIVE',NULL,'2026-10-15'),(102,'Synthetic','PENDING',NULL,'2026-10-15'),"
            +"(103,'Synthetic','SUSPENDED','ACTIVE','2026-10-15'),(104,'Synthetic','ARCHIVED',NULL,'2026-10-15'),"
            +"(105,'Synthetic','SUSPENDED','PENDING','2026-10-15'),(106,'Synthetic','ACTIVE',NULL,'2026-01-01')");
        sql("INSERT INTO ARG_ACCOUNT_IDENTITY(id,user_id,provider,subject,disabled_at,created_at) VALUES"
            +"(1,101,'google','g1',NULL,'2026-10-15'),(2,101,'github','h1',NULL,'2026-10-15'),"
            +"(3,101,'google','g2',NULL,'2026-10-15'),(4,103,'linkedin','l1',NULL,'2026-10-15'),"
            +"(5,104,'google','g3','2026-10-16','2026-10-15'),(6,106,'google','g4',NULL,'2026-01-01')");
        try(var c=source.getConnection()) {
            var all=statistics.read(c,null,NOW).accounts();
            assertEquals(new AdminStatisticsDao.Accounts(6,3,2,1,1,2,1,1),all);
            assertEquals(new AdminStatisticsDao.Accounts(5,2,2,1,1,1,1,1),
                statistics.read(c,NOW.minusSeconds(7*86400),NOW).accounts());
        }
    }

    @Test void uniqueUrlsUseLatestRunWithTiesAllStatusesAndExactHostnames() throws Exception {
        // Existing fixture contains five attempts on the same normalized URL, ending in FAILED.
        sql("UPDATE ARG_AUDIT_RUN SET created_at='2026-01-01'");
        sql("UPDATE ARG_AUDIT_RUN SET created_at='2026-10-16' WHERE id=5");
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(2,'www.example.com'),(3,'shop.example.com'),(4,'saved.example.com')");
        sql("INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES"
            +"(2,'https://example.com/a','https://example.com/a',1),(3,'https://www.example.com','https://www.example.com',2),"
            +"(4,'https://shop.example.com/a','https://shop.example.com/a',3),(5,'https://shop.example.com/b','https://shop.example.com/b',3),"
            +"(6,'https://example.com/unknown','https://example.com/unknown',1),(7,'https://example.com/queued','https://example.com/queued',1),"
            +"(8,'https://saved.example.com','https://saved.example.com',4)");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,created_at) VALUES"
            +"(10,2,'FAILED','2026-10-15'),(11,2,'COMPLETED','2026-10-15'),"
            +"(12,3,'RUNNING','2026-10-15'),(13,4,'COMPLETED','2026-10-15'),"
            +"(14,5,'CANCELED','2026-10-15'),(15,6,'FUTURE_STATUS','2026-10-15'),(16,7,'QUEUED','2026-10-15')");
        sql("UPDATE ARG_AUDIT_RUN SET module_statuses='{\"http\":\"COMPLETED\",\"lighthouse\":\"FAILED\"}' WHERE id=13");
        // A finished run with missing/partial measures must remain COMPLETED, even without a report.
        try(var c=source.getConnection()) {
            var all=statistics.read(c,null,NOW);
            assertEquals(new AdminStatisticsDao.Analyses(7,1,1,2,1,1,1),all.analyses());
            assertEquals(3,all.domains().total());
            assertEquals(7.0/3,all.domains().averageUrls());
            var recent=statistics.read(c,NOW.minusSeconds(7*86400),NOW);
            assertEquals(new AdminStatisticsDao.Analyses(6,1,1,2,0,1,1),recent.analyses());
            assertEquals(2,recent.domains().averageUrls());
        }
    }

    @Test void noDataReturnsRealZeroIncludingAverage() throws Exception {
        sql("DELETE FROM ARG_AUDIT_REPORT");
        sql("DELETE FROM ARG_AUDIT_RUN");
        try(var c=source.getConnection()) {
            // The saved URL/domain remain, but there are no analyses to count.
            var result=statistics.read(c,null,NOW);
            assertEquals(0,result.accounts().created());
            assertEquals(new AdminStatisticsDao.Analyses(0,0,0,0,0,0,0),result.analyses());
            assertEquals(new AdminStatisticsDao.Domains(0,0),result.domains());
        }
    }
}
