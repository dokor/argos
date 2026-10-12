package com.dokor.argos.db;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.junit.jupiter.api.Assertions.*;

class QuerydslGeneratorTest {
    @TempDir Path temporary;

    @Test void generatesPreviewFromDisposableDatabaseWithoutChangingIt() throws Exception {
        String url = "jdbc:h2:mem:querydsl-" + UUID.randomUUID();
        String password = System.getenv().getOrDefault("QUERYDSL_DB_PASSWORD", "");
        try (var connection = DriverManager.getConnection(url, "sa", password);
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE ARG_PREVIEW (ID BIGINT PRIMARY KEY, CREATED_AT TIMESTAMP, NAME VARCHAR(80))");
            statement.execute("CREATE TABLE UNRELATED (ID BIGINT)");
            statement.execute("CREATE SCHEMA EXTRA");
            statement.execute("CREATE TABLE EXTRA.ARG_OTHER (ID BIGINT)");
            statement.execute("INSERT INTO ARG_PREVIEW (ID, NAME) VALUES (7, 'fixture')");

            QuerydslGenerator.main(url, "sa", temporary.resolve("preview").toString());
            Path generated = temporary.resolve("preview/com/dokor/argos/db/generated");
            assertTrue(Files.readString(generated.resolve("Preview.java")).contains("class Preview"));
            assertTrue(Files.readString(generated.resolve("QPreview.java")).contains("class QPreview"));
            assertFalse(Files.exists(generated.resolve("QUnrelated.java")));
            assertFalse(Files.exists(generated.resolve("QOther.java")));
            try (var rows = statement.executeQuery("SELECT NAME FROM ARG_PREVIEW WHERE ID = 7")) {
                assertTrue(rows.next());
                assertEquals("fixture", rows.getString(1));
                assertFalse(rows.next());
            }
        }
    }

    @Test void refusesExistingOutputAndSourceDirectoriesBeforeConnecting() throws Exception {
        Path existing = temporary.resolve("existing");
        Files.createDirectories(existing);
        Path marker = existing.resolve("keep.txt");
        Files.writeString(marker, "preserve");
        assertThrows(IllegalArgumentException.class,
            () -> QuerydslGenerator.main("jdbc:no-driver", "fixture", existing.toString()));
        assertEquals("preserve", Files.readString(marker));
        Path source = temporary.resolve("src/main/java");
        assertThrows(IllegalArgumentException.class,
            () -> QuerydslGenerator.main("jdbc:no-driver", "fixture", source.toString()));
        assertFalse(Files.exists(source));
    }

    @Test void failsExplicitlyOnMissingArgumentsOrConnectionError() {
        assertThrows(IllegalArgumentException.class, () -> QuerydslGenerator.main());
        assertThrows(IllegalArgumentException.class,
            () -> QuerydslGenerator.main("${querydsl.jdbc.url}", "fixture", temporary.toString()));
        assertThrows(SQLException.class,
            () -> QuerydslGenerator.main("jdbc:no-driver", "fixture", temporary.toString()));
    }
}
