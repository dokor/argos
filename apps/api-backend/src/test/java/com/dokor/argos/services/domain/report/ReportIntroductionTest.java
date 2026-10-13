package com.dokor.argos.services.domain.report;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ReportIntroductionTest {
    final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    ReportDto report() throws Exception {
        return mapper.readValue("""
            {"domain":"fixture.example","scores":{"global":92},"issues":[{"id":"html.title"},{"id":"html.h1.count"}]}
            """, ReportDto.class);
    }
    ReportIntroduction input(List<String> keys) { return new ReportIntroduction("Provider", "Context", keys, "Review together", "forged date"); }
    @Test void requiresExistingUniqueFindingsAndServerDateWithoutChangingMeasurements() throws Exception {
        var report = report(); var original = mapper.writeValueAsString(report);
        var note = ReportIntroduction.prepare(input(List.of("html.title", "html.h1.count")), report, "2026-10-13T10:00:00Z");
        assertEquals("2026-10-13T10:00:00Z", note.publishedAt()); assertEquals(original, mapper.writeValueAsString(report));
        for (var keys : List.of(List.of("html.title"), List.of("html.title", "html.title"), List.of("html.title", "other.report.finding")))
            assertThrows(AccountError.class, () -> ReportIntroduction.prepare(input(keys), report, "today"));
        assertThrows(AccountError.class, () -> ReportIntroduction.prepare(new ReportIntroduction("x".repeat(121), "c", List.of("html.title", "html.h1.count"), "n", null), report, "today"));
    }
    @Test void publicReadsOverlayOnlyPublishedTextAndExpiryRevokesBoth() throws Exception {
        var tokens = new TokenService(); var dao = mock(AuditReportDao.class); var entity = new AuditReport();
        entity.setCreatedAt(Instant.now()); entity.setTokenHash(tokens.sha256("synthetic")); entity.setReportJson(mapper.writeValueAsString(report()));
        var original = entity.getReportJson(); var reader = new ReportReadService(dao, tokens, mapper);
        when(dao.findByTokenHash(any())).thenReturn(Optional.of(entity));
        assertNull(reader.getByToken("synthetic").orElseThrow().introduction());
        entity.setIntroductionJson(mapper.writeValueAsString(input(List.of("html.title", "html.h1.count"))));
        assertEquals("Provider", reader.getByToken("synthetic").orElseThrow().introduction().author());
        assertEquals(original, entity.getReportJson());
        entity.setIntroductionJson(null); assertNull(reader.getByToken("synthetic").orElseThrow().introduction());
        entity.setExpiresAt(Instant.EPOCH); assertTrue(reader.getByToken("synthetic").isEmpty());
    }
}
