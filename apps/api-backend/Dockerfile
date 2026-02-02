# ---- build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src

# 1) Build le jar
# 2) Copie les dépendances runtime dans target/dependency
RUN mvn -q -DskipTests package \
 && mvn -q -DskipTests dependency:copy-dependencies \
      -DincludeScope=runtime \
      -DoutputDirectory=target/dependency

# ---- runtime stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copie le jar de l’app
COPY --from=build /app/target/*.jar /app/app.jar
# Copie les deps runtime
COPY --from=build /app/target/dependency /app/lib

EXPOSE 8080

# Lance avec le classpath complet
ENTRYPOINT ["sh","-c","java ${JAVA_OPTS:-} -cp '/app/app.jar:/app/lib/*' com.dokor.argos.WebApplication"]
