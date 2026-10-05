package com.dokor.argos.db.dao;

import java.sql.SQLException;

/** Only MariaDB/MySQL duplicate-key errors may be recovered by looking up the winner. */
final class UniqueInsertConflict {
    private UniqueInsertConflict() {}
    static boolean isDuplicate(Throwable error) {
        for (int depth = 0; error != null && depth < 16; depth++, error = error.getCause()) {
            if (error instanceof SQLException sql && sql.getErrorCode() == 1062 && "23000".equals(sql.getSQLState())) return true;
        }
        return false;
    }
}
