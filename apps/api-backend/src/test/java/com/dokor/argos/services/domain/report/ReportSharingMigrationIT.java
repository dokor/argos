package com.dokor.argos.services.domain.report;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReportSharingMigrationIT extends MariaDbReportFixture {
    @Test void upgradesV28WithExistingReportsAndValidatesOnRestart() throws Exception {
        var before=Flyway.configure().dataSource(source).cleanDisabled(false).target("28").load();
        before.clean();before.migrate();
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(1,'example.com')");
        sql("INSERT INTO ARG_AUDIT(id,domain_id,input_url,normalized_url) VALUES(1,1,'https://example.com','https://example.com')");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status) VALUES(1,1,'COMPLETED'),(2,1,'COMPLETED')");
        sql("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json) VALUES(1,1,1,UNHEX(SHA2('fixture-one',256)),'example.com','https://example.com','{\"domain\":\"example.com\"}'),(2,1,2,UNHEX(SHA2('fixture-two',256)),'example.com','https://example.com','{\"domain\":\"example.com\"}')");
        var latest=Flyway.configure().dataSource(source).load();
        assertEquals(9,latest.migrate().migrationsExecuted);latest.validate();assertEquals(0,latest.migrate().migrationsExecuted);
        try(var c=source.getConnection();var s=c.createStatement();var rows=s.executeQuery("SELECT report_json,share_token_hash,share_expires_at FROM ARG_AUDIT_REPORT WHERE id=1")) {
            assertTrue(rows.next());assertEquals("example.com",mapper.readTree(rows.getString(1)).get("domain").asText());assertNull(rows.getBytes(2));assertNull(rows.getTimestamp(3));
        }
        sql("UPDATE ARG_AUDIT_REPORT SET share_token_hash=UNHEX(SHA2('share',256)),share_expires_at='2026-11-01 12:34:56.123' WHERE id=1");
        assertThrows(java.sql.SQLException.class,()->sql("UPDATE ARG_AUDIT_REPORT SET share_token_hash=UNHEX(SHA2('share',256)) WHERE id=2"));
        try(var c=source.getConnection();var s=c.createStatement();var rows=s.executeQuery("SELECT OCTET_LENGTH(share_token_hash),DATE_FORMAT(share_expires_at,'%f') FROM ARG_AUDIT_REPORT WHERE id=1")) {
            assertTrue(rows.next());assertEquals(32,rows.getInt(1));assertEquals("123000",rows.getString(2));
        }
    }
}
