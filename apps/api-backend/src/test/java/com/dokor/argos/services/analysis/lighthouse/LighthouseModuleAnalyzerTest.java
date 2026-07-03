package com.dokor.argos.services.analysis.lighthouse;

import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.net.http.HttpTimeoutException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class LighthouseModuleAnalyzerTest {

    private static AuditContext ctx() {
        return new AuditContext("http://example.com", "http://example.com", 1L);
    }

    @Test
    void marksTimeoutWhenClientTimesOut() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenThrow(new HttpTimeoutException("request timed out"));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("TIMEOUT", res.data().get("reason"));
        assertEquals(1, res.checks().size());
        assertEquals(AuditStatus.WARN, res.checks().get(0).status());
    }

    @Test
    void marksFailedOnGenericError() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenThrow(new IllegalStateException("service 500"));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("FAILED", res.data().get("reason"));
    }
}
