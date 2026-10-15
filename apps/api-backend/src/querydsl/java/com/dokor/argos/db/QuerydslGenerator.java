package com.dokor.argos.db;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.Locale;
import java.util.Properties;

import com.coreoz.plume.db.querydsl.generation.IdBeanSerializer;
import com.querydsl.codegen.EntityType;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.SQLTemplates;
import com.querydsl.sql.codegen.DefaultNamingStrategy;
import com.querydsl.sql.codegen.MetaDataExporter;
import com.querydsl.sql.types.JSR310InstantType;
import com.querydsl.sql.types.JSR310LocalDateType;
import com.querydsl.sql.types.JSR310LocalTimeType;
import com.querydsl.sql.types.JSR310ZonedDateTimeType;
import com.querydsl.sql.types.Type;

/**
 * Explicit development-only preview against a disposable database. See the backend README.
 * Never reads application.conf or runs migrations; output must be a new or empty directory.
 */
public class QuerydslGenerator {
    private static final String TABLES_PREFIX = "ARG_";

	public static void main(String... args) throws Exception {
        if (args.length != 3 || !args[0].startsWith("jdbc:") || args[1].isBlank()
            || args[2].isBlank() || args[2].contains("${")) {
            throw new IllegalArgumentException("Expected explicit JDBC URL, user and empty preview directory");
        }
        Path output = Path.of(args[2]).toAbsolutePath().normalize();
        for (Path part : output) {
            if (part.toString().equalsIgnoreCase("src")) {
                throw new IllegalArgumentException("Preview output cannot be under a src directory");
            }
        }
        Files.createDirectories(output);
        output = output.toRealPath();
        for (Path part : output) {
            if (part.toString().equalsIgnoreCase("src")) {
                throw new IllegalArgumentException("Preview output cannot be under a src directory");
            }
        }
        try (var files = Files.list(output)) {
            if (files.findAny().isPresent()) {
                throw new IllegalArgumentException("Preview directory must be empty");
            }
        }

		Configuration configuration = new Configuration(SQLTemplates.DEFAULT);
		configuration.register(classType(JSR310InstantType.class));
		configuration.register(classType(JSR310LocalDateType.class));
		configuration.register(classType(JSR310LocalTimeType.class));
		configuration.register(classType(JSR310ZonedDateTimeType.class));
		configuration.registerNumeric(1, 0, Boolean.class);
		configuration.registerNumeric(9, 0, Long.class);
		configuration.registerNumeric(19, 0, Long.class);

		MetaDataExporter exporter = new MetaDataExporter();
		exporter.setPackageName("com.dokor.argos.db.generated");
		exporter.setTargetFolder(output.toFile());
		exporter.setTableNamePattern(TABLES_PREFIX + "%");
		exporter.setNamingStrategy(new DefaultNamingStrategy() {
			@Override
			public String getClassName(String tableName) {
				return super.getClassName(tableName.substring(TABLES_PREFIX.length()));
			}

			@Override
			public String getDefaultVariableName(EntityType entityType) {
				String variableName = getClassName(entityType.getData().get("table").toString());
				return variableName.substring(0, 1).toLowerCase(Locale.ENGLISH) + variableName.substring(1);
			}
		});
		IdBeanSerializer beanSerializer = new IdBeanSerializer().setUseJacksonAnnotation(true);
		beanSerializer.setAddToString(true);
		exporter.setBeanSerializer(beanSerializer);
		exporter.setColumnAnnotations(true);
		exporter.setConfiguration(configuration);

        Properties connectionProperties = new Properties();
        connectionProperties.setProperty("user", args[1]);
        connectionProperties.setProperty("password", System.getenv().getOrDefault("QUERYDSL_DB_PASSWORD", ""));
        try (var connection = DriverManager.getConnection(args[0], connectionProperties)) {
            exporter.setCatalogPattern(connection.getCatalog());
            exporter.setSchemaPattern(connection.getSchema());
            exporter.export(connection.getMetaData());
        }
	}

    private static Type<?> classType(Class<?> classType) throws ReflectiveOperationException {
        return (Type<?>) classType.getConstructor().newInstance();
    }
}
