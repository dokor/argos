package com.dokor.argos.services.domain.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Tests unitaires de {@link AuditService#extractGlobalScore} : extraction robuste
 * du score global (champ {@code scores.global}) du JSON d'un rapport publié,
 * utilisée pour l'historique des analyses (issue #11).
 */
class AuditServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void extractsGlobalScoreFromReportJson() {
        String json = "{\"scores\":{\"global\":68,\"byCategory\":[]}}";
        assertEquals(68, AuditService.extractGlobalScore(objectMapper, json));
    }

    @Test
    void returnsNullWhenJsonIsNullOrBlank() {
        assertNull(AuditService.extractGlobalScore(objectMapper, null));
        assertNull(AuditService.extractGlobalScore(objectMapper, ""));
        assertNull(AuditService.extractGlobalScore(objectMapper, "   "));
    }

    @Test
    void returnsNullWhenScoresGlobalIsMissing() {
        assertNull(AuditService.extractGlobalScore(objectMapper, "{\"scores\":{\"byCategory\":[]}}"));
        assertNull(AuditService.extractGlobalScore(objectMapper, "{}"));
    }

    @Test
    void returnsNullWhenJsonIsMalformed() {
        assertNull(AuditService.extractGlobalScore(objectMapper, "{not valid json"));
    }
}
