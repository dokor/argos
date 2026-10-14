package com.dokor.argos.operations;

import java.sql.*;
import java.util.UUID;

/** Offline operator entry point. Never registered with Guice/Jersey or called at startup. */
public final class FirstAdminBootstrap {
    private FirstAdminBootstrap() {}

    public static void main(String[] args) {
        try {
            if ((args.length != 4 && args.length != 5)
                    || !"--database".equals(args[0])
                    || !"--user-id".equals(args[2])
                    || (args.length == 5 && !"--apply".equals(args[4])))
                throw new IllegalArgumentException("arguments_invalid");
            String url = required("ARGOS_BOOTSTRAP_JDBC_URL");
            if (!url.startsWith("jdbc:mariadb:"))
                throw new IllegalArgumentException("jdbc_invalid");
            long userId = Long.parseLong(args[3]);
            try (var c =
                    DriverManager.getConnection(
                            url,
                            required("ARGOS_BOOTSTRAP_USER"),
                            required("ARGOS_BOOTSTRAP_PASSWORD"))) {
                boolean changed = execute(c, args[1], userId, args.length == 5);
                System.out.println((changed ? "APPLIED" : "DRY_RUN") + " userId=" + userId);
            }
        } catch (Exception e) {
            // Driver messages can include connection parameters: never print them or a stack trace.
            System.err.println(
                    "First ADMIN bootstrap refused or failed. Check the named database, verified"
                        + " account, existing ADMIN and operator runbook.");
            System.exit(1);
        }
    }

    private static String required(String name) {
        var value = System.getenv(name);
        if (value == null || value.isBlank())
            throw new IllegalArgumentException("configuration_missing");
        return value;
    }

    /** Owns the transaction on a dedicated connection; dry run writes nothing. */
    public static boolean execute(Connection c, String expectedDatabase, long userId, boolean apply)
            throws SQLException {
        if (expectedDatabase == null
                || !expectedDatabase.matches("[A-Za-z0-9_]{1,64}")
                || userId < 1
                || !c.getAutoCommit()) throw new IllegalArgumentException("arguments_invalid");
        try (var s = c.createStatement();
                var r = s.executeQuery("SELECT DATABASE()")) {
            if (!r.next() || !expectedDatabase.equals(r.getString(1)))
                throw new IllegalStateException("database_mismatch");
        }
        // Serialize this offline tool, including two operators targeting different users.
        try (var s = c.createStatement();
                var r = s.executeQuery("SELECT GET_LOCK('argos:first-admin',5)")) {
            if (!r.next() || r.getInt(1) != 1) throw new IllegalStateException("bootstrap_busy");
        }
        try {
            c.setAutoCommit(false);
            try (var s = c.createStatement();
                    var r =
                            s.executeQuery(
                                    "SELECT id FROM ARG_ACCOUNT_USER WHERE role='ADMIN' LIMIT 1")) {
                if (r.next()) throw new IllegalStateException("admin_already_exists");
            }
            try (var s =
                    c.prepareStatement(
                            "SELECT state,role,email,admin_version FROM ARG_ACCOUNT_USER WHERE id=?"
                                + " FOR UPDATE")) {
                s.setLong(1, userId);
                try (var r = s.executeQuery()) {
                    if (!r.next()
                            || !"ACTIVE".equals(r.getString(1))
                            || !"USER".equals(r.getString(2))
                            || r.getString(3) == null
                            || r.getLong(4) >= 9007199254740991L)
                        throw new IllegalStateException("target_ineligible");
                }
            }
            try (var s =
                    c.prepareStatement(
                            "SELECT id FROM ARG_ACCOUNT_IDENTITY WHERE user_id=? AND disabled_at IS"
                                + " NULL LIMIT 1")) {
                s.setLong(1, userId);
                try (var r = s.executeQuery()) {
                    if (!r.next()) throw new IllegalStateException("identity_missing");
                }
            }
            if (!apply) {
                c.rollback();
                return false;
            }
            update(
                    c,
                    "UPDATE ARG_ACCOUNT_USER SET role='ADMIN',admin_version=admin_version+1 WHERE"
                        + " id=?",
                    userId);
            update(
                    c,
                    "UPDATE ARG_ACCOUNT_SESSION SET"
                        + " revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP(3)) WHERE user_id=?",
                    userId);
            update(
                    c,
                    "UPDATE ARG_ACCOUNT_TOKEN SET"
                        + " consumed_at=COALESCE(consumed_at,CURRENT_TIMESTAMP(3)) WHERE user_id=?",
                    userId);
            update(
                    c,
                    "UPDATE ARG_ACCOUNT_OAUTH SET"
                        + " consumed_at=COALESCE(consumed_at,CURRENT_TIMESTAMP(3)) WHERE user_id=?",
                    userId);
            try (var s =
                    c.prepareStatement(
                            "INSERT INTO"
                                + " ARG_ACCOUNT_SECURITY_EVENT(id,user_id,action,outcome,created_at)"
                                + " VALUES(?,?,'bootstrap_admin','accepted',CURRENT_TIMESTAMP(3))")) {
                s.setLong(1, UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE);
                s.setLong(2, userId);
                s.executeUpdate();
            }
            c.commit();
            return true;
        } catch (SQLException | RuntimeException e) {
            c.rollback();
            throw e;
        } finally {
            try {
                c.setAutoCommit(true);
            } finally {
                try (var s = c.createStatement()) {
                    s.execute("DO RELEASE_LOCK('argos:first-admin')");
                }
            }
        }
    }

    private static void update(Connection c, String sql, long user) throws SQLException {
        try (var s = c.prepareStatement(sql)) {
            s.setLong(1, user);
            s.executeUpdate();
        }
    }
}
