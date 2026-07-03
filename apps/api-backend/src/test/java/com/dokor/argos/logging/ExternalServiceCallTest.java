package com.dokor.argos.logging;

import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Tests unitaires de {@link ExternalServiceCall} (issue #41) : l'enveloppe de
 * logging ne doit rien changer au contrat — retour transmis, exception propagée —
 * quelle que soit la cible (y compris null ou contenant des CRLF).
 */
class ExternalServiceCallTest {

    private static final org.slf4j.Logger LOG = LoggerFactory.getLogger(ExternalServiceCallTest.class);

    @Test
    void returnsActionResult() throws Exception {
        Object expected = new Object();
        Object result = ExternalServiceCall.timed(LOG, "svc", "https://example.com", () -> expected);
        assertSame(expected, result);
    }

    @Test
    void propagatesActionException() {
        IllegalStateException boom = new IllegalStateException("boom");
        IllegalStateException thrown = assertThrows(IllegalStateException.class,
            () -> ExternalServiceCall.timed(LOG, "svc", "https://example.com", () -> {
                throw boom;
            }));
        assertSame(boom, thrown);
    }

    @Test
    void handlesNullAndControlCharTargetsWithoutFailing() throws Exception {
        assertEquals("ok", ExternalServiceCall.timed(LOG, "svc", null, () -> "ok"));
        // Une cible contenant des CRLF ne doit pas empêcher l'appel (sanitisation interne).
        assertEquals("ok", ExternalServiceCall.timed(LOG, "svc", "https://x/\r\ninjected", () -> "ok"));
    }
}
