package com.dokor.argos.db.dao;

import jakarta.inject.Singleton;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

/** Share persistence on the caller's transaction; ownership locks precede mutations. */
@Singleton
public class ReportSharingDao {
    public boolean lockOwnedRun(Connection connection, long run, long owner) {
        try (var statement = connection.prepareStatement(
                "SELECT id FROM ARG_AUDIT_RUN WHERE id=? AND owner_user_id=? FOR UPDATE")) {
            statement.setLong(1, run);
            statement.setLong(2, owner);
            try (var rows = statement.executeQuery()) { return rows.next(); }
        } catch (SQLException error) { throw new IllegalStateException("Share ownership unavailable", error); }
    }

    public boolean replace(Connection connection, long run, byte[] hash, Instant expiresAt) {
        try (var statement = connection.prepareStatement(
                "UPDATE ARG_AUDIT_REPORT SET share_token_hash=?,share_expires_at=? WHERE run_id=?")) {
            statement.setBytes(1, hash);
            statement.setTimestamp(2, expiresAt == null ? null : Timestamp.from(expiresAt));
            statement.setLong(3, run);
            return statement.executeUpdate() == 1;
        } catch (SQLException error) { throw new IllegalStateException("Share update failed", error); }
    }

    public Optional<Long> findActiveRun(Connection connection, byte[] hash, Instant now) {
        try (var statement = connection.prepareStatement(
                "SELECT run_id FROM ARG_AUDIT_REPORT WHERE share_token_hash=? AND (share_expires_at IS NULL OR share_expires_at>?)")) {
            statement.setBytes(1, hash);
            statement.setTimestamp(2, Timestamp.from(now));
            try (var rows = statement.executeQuery()) {
                return rows.next() ? Optional.of(rows.getLong(1)) : Optional.empty();
            }
        } catch (SQLException error) { throw new IllegalStateException("Shared report unavailable", error); }
    }
}
