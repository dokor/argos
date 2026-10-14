package com.dokor.argos.services.domain.report;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;

class ReportCompletenessTest {
    final ObjectMapper mapper = new ObjectMapper();

    ReportDto report(int operational, double ratio, String state) throws Exception {
        return mapper.readValue(
                "{\"scores\":{\"global\":0,\"completeness\":"
                        + operational
                        + ",\"coverage\":{\"global\":{\"expectedWeight\":1,\"ratio\":"
                        + ratio
                        + ",\"available\":true},\"checks\":[{\"weight\":1,\"state\":\""
                        + state
                        + "\"}]}}}",
                ReportDto.class);
    }

    @Test
    void zeroQualityCanHaveFullEvidence() throws Exception {
        assertEquals("FULL", ReportCompleteness.from(report(100, 1, "MEASURED")));
    }

    @Test
    void sufficientCoverageIsNotFullEvidence() throws Exception {
        assertEquals("PARTIAL", ReportCompleteness.from(report(100, .9, "MEASURED")));
        assertEquals("PARTIAL", ReportCompleteness.from(report(90, 1, "MEASURED")));
        assertEquals("PARTIAL", ReportCompleteness.from(report(100, 1, "UNAVAILABLE")));
        assertEquals("PARTIAL", ReportCompleteness.from(report(100, 1, "BLOCKED_BY_ANTIBOT")));
    }

    @Test
    void missingMetadataNeverInventsCompleteness() throws Exception {
        assertEquals("UNKNOWN", ReportCompleteness.from(mapper.readValue("{}", ReportDto.class)));
        assertEquals(
                "UNKNOWN",
                ReportCompleteness.from(
                        mapper.readValue("{\"scores\":{\"completeness\":100}}", ReportDto.class)));
    }
}
