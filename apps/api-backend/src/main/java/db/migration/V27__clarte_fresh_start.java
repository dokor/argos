package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.List;
import java.util.HashMap;
import java.util.zip.CRC32;

/** One-time, destructive Clarte cutover. All API instances/workers must be stopped. */
public class V27__clarte_fresh_start extends BaseJavaMigration {
    // Children before parents; keep FK checks and the admission triggers enabled.
    private static final List<String> TABLES = List.of(
            "ARG_DOMAIN_BATCH_PAGE", "ARG_DOMAIN_BATCH", "ARG_DOMAIN_DISCOVERY_PAGE",
            "ARG_DOMAIN_DISCOVERY", "ARG_ACCOUNT_SITE_URL", "ARG_ACCOUNT_SITE",
            "ARG_USAGE_RUN", "ARG_ACCOUNT_RUN_CLAIM", "ARG_PRODUCT_AUDIT_ATTR",
            "ARG_AUDIT_REPORT", "ARG_AUDIT_RUN", "ARG_AUDIT", "ARG_DOMAIN_ANALYSIS",
            "ARG_DOMAIN", "ARG_ACCOUNT_OAUTH", "ARG_ACCOUNT_TOKEN", "ARG_ACCOUNT_SESSION",
            "ARG_ACCOUNT_IDENTITY", "ARG_ACCOUNT_SECURITY_EVENT", "ARG_ACCOUNT_RATE",
            "ARG_ADMIN_EVENT", "ARG_USAGE_ACCOUNT", "ARG_ACCOUNT_USER", "ARG_FEEDBACK_EVENT",
            "ARG_FEEDBACK", "ARG_PRODUCT_EVENT_COUNT", "ARG_NEWSLETTER_SUBSCRIBER",
            "ARG_AUDIT_ADMISSION", "ARG_DISCOVERY_GATE");
    private static final List<String> SEEDS = List.of(
            "INSERT INTO ARG_AUDIT_ADMISSION(id,pending) VALUES(1,0)",
            "INSERT INTO ARG_DISCOVERY_GATE(id) VALUES(1)");

    @Override public Integer getChecksum() {
        var checksum = new CRC32();
        // Increment the algorithm revision if the transaction/preflight logic ever changes.
        checksum.update(("revision=1\n" + String.join("\n", TABLES) + "\n" + String.join("\n", SEEDS))
                .getBytes(StandardCharsets.UTF_8));
        return (int) checksum.getValue();
    }

    @Override public boolean canExecuteInTransaction() { return false; }

    @Override public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        if (!connection.getAutoCommit()) throw new SQLException("Clarte reset requires its own transaction");
        var engines = new HashMap<String, String>();
        try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                "SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")) {
            while (rows.next()) engines.put(rows.getString(1), rows.getString(2));
        }
        for (var table : TABLES) {
            if (!"InnoDB".equalsIgnoreCase(engines.get(table)))
                throw new SQLException("Clarte reset requires an existing InnoDB table: " + table);
        }
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("SELECT @@SESSION.foreign_key_checks")) {
            if (!rows.next() || rows.getInt(1) != 1)
                throw new SQLException("Clarte reset requires foreign key checks enabled");
        }
        // MariaDB DDL is nontransactional. Use only DML and manage rollback explicitly.
        // Do not TRUNCATE, reset sequences, disable constraints or alter Flyway's history.
        connection.setAutoCommit(false);
        try {
            try (var statement = connection.createStatement()) {
                for (var table : TABLES) statement.executeUpdate("DELETE FROM " + table);
                for (var seed : SEEDS) statement.executeUpdate(seed);
            }
            connection.commit();
        } catch (Exception failure) {
            try {
                connection.rollback();
            } catch (SQLException rollbackFailure) {
                // Never switch to autocommit after an unconfirmed rollback.
                failure.addSuppressed(rollbackFailure);
                throw failure;
            }
            connection.setAutoCommit(true);
            throw failure;
        }
        connection.setAutoCommit(true);
    }
}
