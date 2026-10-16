package com.dokor.argos.services.analysis.modules.tech;

import com.dokor.argos.services.domain.report.TechReportMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class HostingDetectorTest {
    @Test void cdnDoesNotRevealOriginOrNetworkOwner() {
        var hosting=HostingDetector.detect(Map.of("CF-Ray","sensitive-request-id","Server","cloudflare"));
        assertNull(hosting.applicationHost());assertNull(hosting.networkProvider());assertEquals("UNKNOWN",hosting.originStatus());
        assertEquals("Cloudflare",hosting.cdnProxies().getFirst().name());
        assertFalse(hosting.toString().contains("sensitive-request-id"));
    }
    @Test void identifiesProbablePlatformAndCdnSeparately() {
        var hosting=HostingDetector.detect(Map.of("X-Vercel-Id","request","cf-ray","proxy-request"));
        assertEquals("Vercel",hosting.applicationHost().name());assertEquals("MEDIUM",hosting.applicationHost().confidence());
        assertEquals("Cloudflare",hosting.cdnProxies().getFirst().name());
        assertEquals(hosting,TechReportMapper.fromTechModuleData(Map.of("hosting",hosting)).hosting());
        assertEquals("Netlify",HostingDetector.detect(Map.of("x-nf-request-id","request")).applicationHost().name());
    }
    @Test void sharedServerIpMissingAndConflictingSignalsStayUnknown() {
        assertNull(HostingDetector.detect(Map.of("server","nginx","x-powered-by","PHP")).applicationHost());
        assertNull(HostingDetector.detect(null).applicationHost());
        assertNull(HostingDetector.detect(Map.of("x-vercel-id","request","x-nf-request-id","request")).applicationHost());
        assertNull(HostingDetector.detect(Map.of("x-vercel-id"," ")).applicationHost());
        var cdn=HostingDetector.detect(Map.of("x-amz-cf-id","request"));
        assertNull(cdn.applicationHost());assertEquals("Amazon CloudFront",cdn.cdnProxies().getFirst().name());
    }
}
