package com.dokor.argos.services.analysis;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests unitaires de {@link AuditProcessorService#completenessPercent} (issue #101) :
 * indicateur de complétude d'un audit (part des modules évalués), stable et borné.
 */
class AuditProcessorCompletenessTest {

    @Test
    void fullCoverageWhenAllModulesEvaluated() {
        assertEquals(100, AuditProcessorService.completenessPercent(8, 8));
    }

    @Test
    void partialCoverageIsRounded() {
        // 7/8 = 87,5 % → 88
        assertEquals(88, AuditProcessorService.completenessPercent(7, 8));
        // 5/8 = 62,5 % → 63 (arrondi au plus proche)
        assertEquals(63, AuditProcessorService.completenessPercent(5, 8));
    }

    @Test
    void zeroWhenNothingEvaluated() {
        assertEquals(0, AuditProcessorService.completenessPercent(0, 8));
    }

    @Test
    void hundredWhenNoModulesExpected() {
        // Pas de module prévu ⇒ pas de partialité (évite une division par zéro).
        assertEquals(100, AuditProcessorService.completenessPercent(0, 0));
    }
}
