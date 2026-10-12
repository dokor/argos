#!/usr/bin/env bash
# Run from apps/api-backend against the dedicated empty CI schema, never production.
set -euo pipefail
: "${QUERYDSL_SMOKE_JDBC_URL:?Provide the disposable schema URL}"
: "${QUERYDSL_SMOKE_USER:?Provide the disposable schema user}"
: "${QUERYDSL_DB_PASSWORD:?Provide the disposable schema password}"
export DB_PASSWORD="$QUERYDSL_DB_PASSWORD"
export INTERNAL_API_PASSWORD=synthetic-querydsl-smoke

mkdir -p target
cat > target/querydsl-smoke.conf <<'CONFIG'
include classpath("application.conf")
db.hikari."dataSource.url" = ${QUERYDSL_SMOKE_JDBC_URL}
db.hikari."dataSource.user" = ${QUERYDSL_SMOKE_USER}
audit.scheduler.interval = 1h
CONFIG

# Use only the packaged runtime classpath, not Maven's test/plugin dependencies.
if find target/dist/api-backend/lib -name '*.jar' | grep -E '(codegen|ecj-|javax.inject)' ; then
  echo 'Development dependency found in runtime distribution' >&2
  exit 1
fi
if jar tf target/api-backend.jar | grep -q QuerydslGenerator; then
  echo 'Generator found in runtime JAR' >&2
  exit 1
fi
java -Dconfig.file=target/querydsl-smoke.conf -Dhttp.port=18081 -Dhttp.address=127.0.0.1 \
  -cp 'target/dist/api-backend/lib/*' com.dokor.argos.WebApplication \
  > target/querydsl-startup.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT
ready=false
for attempt in $(seq 1 30); do
  if curl --silent --fail --max-time 2 -u "internal-api:$INTERNAL_API_PASSWORD" \
    http://127.0.0.1:18081/api/monitoring/info > target/querydsl-monitoring.json; then
    ready=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [ "$ready" != true ]; then
  cat target/querydsl-startup.log
  exit 1
fi

# Compilation/testing alone never invokes main. Generation is a separate explicit goal.
mvn --batch-mode -Pquerydsl-code-generation -Dtest=QuerydslGeneratorTest test
mvn --batch-mode -Pquerydsl-code-generation test-compile exec:java \
  "-Dquerydsl.jdbc.url=$QUERYDSL_SMOKE_JDBC_URL" "-Dquerydsl.jdbc.user=$QUERYDSL_SMOKE_USER"
test -s target/querydsl-preview/com/dokor/argos/db/generated/Audit.java
test -s target/querydsl-preview/com/dokor/argos/db/generated/QAudit.java
mkdir -p target/querydsl-preview-classes
find target/querydsl-preview -name '*.java' > target/querydsl-preview-sources.txt
javac -cp 'target/dist/api-backend/lib/*' -d target/querydsl-preview-classes \
  @target/querydsl-preview-sources.txt
git diff --exit-code HEAD -- src/main/java/com/dokor/argos/db/generated src/main/resources/db/migration
