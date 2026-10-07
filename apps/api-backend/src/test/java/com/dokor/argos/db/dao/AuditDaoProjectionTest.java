package com.dokor.argos.db.dao;

import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import com.querydsl.sql.SQLQuery;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AuditDaoProjectionTest {
    private static SQLQuery<Void> query() {
        return new SQLQuery<>(new Configuration(MySQLTemplates.DEFAULT));
    }

    @Test void overviewSelectsOnlyFieldsNeededByItsResponse() {
        String sql = AuditDao.overviewQuery(query(), 200).getSQL().getSQL().toLowerCase();
        assertTrue(sql.contains("global_score"));
        assertTrue(sql.contains("limit"));
        for (String forbidden : new String[]{"result_json", "report_json", "token_hash", "claim_token", "module_statuses"})
            assertFalse(sql.contains(forbidden), forbidden);
    }

    @Test void historySelectsScoreButNeitherLongtext() {
        String sql = AuditDao.historyQuery(query(), 7, 100).getSQL().getSQL().toLowerCase();
        assertTrue(sql.contains("global_score"));
        assertTrue(sql.contains("created_at desc"));
        for (String forbidden : new String[]{"result_json", "report_json", "token_hash", "claim_token"})
            assertFalse(sql.contains(forbidden), forbidden);
    }
}
