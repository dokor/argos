package com.dokor.argos.services.domain.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class CodexSummaryClientTest {
    private ReportDto report(boolean provisional) throws Exception {
        return new ObjectMapper().readValue("""
            {"scores":{"global":80,"globalAvailable":true,"coverage":{"provisional":%s,
                "global":{"sufficient":true,"measuredWeight":10}}},
             "summary":{"priorities":[]},"issues":[{"id":"http.security.csp"},{"id":"runtime.js.errors"}]}
            """.formatted(provisional), ReportDto.class);
    }
    private ReportDto.AiSummary summary(List<String> keys) {
        var locale = new ReportDto.AiSummaryLocale("Title", "Summary", List.of("A measured finding"), keys);
        return new ReportDto.AiSummary(locale, locale);
    }
    @Test void acceptsOnlyExistingReferencedFindingsAndPersistsTheirReferences() throws Exception {
        var valid = summary(List.of("http.security.csp"));
        assertTrue(CodexSummaryClient.isValid(valid, report(false)));
        var mapper = new ObjectMapper();
        assertEquals(valid, mapper.readValue(mapper.writeValueAsString(valid), ReportDto.AiSummary.class));
        assertFalse(CodexSummaryClient.isValid(summary(List.of("invented.vulnerability")), report(false)));
        assertFalse(CodexSummaryClient.isValid(summary(null), report(false)));
        assertFalse(CodexSummaryClient.isValid(summary(List.of()), report(false)));
        assertFalse(CodexSummaryClient.isValid(summary(List.of("http.security.csp", "runtime.js.errors")), report(false)));
    }
    @Test void insufficientCoverageAndLanguageDisagreementRejectTheSummary() throws Exception {
        var valid = summary(List.of("http.security.csp"));
        assertFalse(CodexSummaryClient.isValid(valid, report(true)));
        var english = summary(List.of("runtime.js.errors")).en();
        assertFalse(CodexSummaryClient.isValid(new ReportDto.AiSummary(valid.fr(), english), report(false)));
        assertFalse(CodexSummaryClient.hasSufficientEvidence(null));
    }
    @Test void oldSummaryRemainsReadableButCannotBePublishedAsNewValidatedOutput() throws Exception {
        var old = new ObjectMapper().readValue("""
            {"fr":{"headline":"A","summary":"B","keyPoints":["C"]},
             "en":{"headline":"A","summary":"B","keyPoints":["C"]}}
            """, ReportDto.AiSummary.class);
        assertNull(old.fr().sourceFindingKeys());
        assertFalse(CodexSummaryClient.isValid(old, report(false)));
    }
}
