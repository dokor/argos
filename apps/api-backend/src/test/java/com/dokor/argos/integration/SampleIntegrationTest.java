package com.dokor.argos.integration;

import com.dokor.argos.guice.TestModule;
import com.dokor.argos.services.domain.audit.enums.AuditRunStatus;

import com.coreoz.test.GuiceTest;
import com.dokor.argos.webservices.api.audits.AuditsWs;
import com.dokor.argos.webservices.api.audits.data.CreateAuditRequest;
import org.assertj.core.api.Assertions;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

/**
 * An integration test sample.
 * <p>
 * This tests differs from an unit tests, cf {@link com.dokor.argos.SampleTest}, because:
 * - It will initialize and rely on the dependency injection, see {@link TestModule} for tests specific overrides
 * - Other services can be referenced for this tests
 * - These other services can be altered for tests, see {@link com.coreoz.plume.mocks.MockedClock} for an example
 * - If a database is used in the project, an H2 in memory database will be available to run queries and verify that data is correctly being inserted/updated in the database
 * - The H2 in memory database will be created by playing Flyway initialization scripts: these scripts must be correctly setup
 * <p>
 * Integration tests are a great tool to test the whole chain of services with one automated test.
 * Although, to intensively test a function, a unit test is preferred, see {@link com.dokor.argos.SampleTest} for an example.
 * <p>
 * Once there are other integration tests in the project, this sample should be deleted.
 */
@GuiceTest(TestModule.class)
public class SampleIntegrationTest {
    @Inject
    AuditsWs auditsWs;

    @Test
    public void integration_test_scenario_description() {
        Assertions
            .assertThat(auditsWs.createAudit(new CreateAuditRequest("https://test.fr")).status())
            .isEqualTo(AuditRunStatus.QUEUED);
    }
}
