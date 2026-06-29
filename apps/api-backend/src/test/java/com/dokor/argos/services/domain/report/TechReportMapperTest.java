package com.dokor.argos.services.domain.report;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TechReportMapperTest {

    // ------------------------------------------------------------------ helpers

    private static Map<String, Object> techData(Object cms, Object ff, Object next) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (cms  != null) m.put("cms", cms);
        if (ff   != null) m.put("frontendFramework", ff);
        if (next != null) m.put("nextJs", next);
        return m;
    }

    private static Map<String, Object> entry(String name, double conf) {
        return Map.of("name", name, "confidence", conf);
    }

    // ------------------------------------------------------------------ tests

    @Test
    void shouldReturnNullForNullInput() {
        assertNull(TechReportMapper.fromTechModuleData(null));
    }

    @Test
    void shouldReturnNullForEmptyInput() {
        assertNull(TechReportMapper.fromTechModuleData(Map.of()));
    }

    @Test
    void shouldReturnNullWhenCmsHasNullName() {
        // cms map present but name is absent → cmsName is null → treated as absent
        Map<String, Object> cmsMap = new LinkedHashMap<>();
        cmsMap.put("name", null);
        cmsMap.put("confidence", 0.9);

        assertNull(TechReportMapper.fromTechModuleData(techData(cmsMap, null, null)),
            "null cms name should yield null Tech");
    }

    @Test
    void shouldReturnNullWhenFrontendFrameworkIsUnknown() {
        // "unknown" value for frontendFramework → treated as absent
        Map<String, Object> ffMap = entry("unknown", 0.5);
        assertNull(TechReportMapper.fromTechModuleData(techData(null, ffMap, null)),
            "frontendFramework=unknown should yield null Tech");
    }

    @Test
    void shouldMapCmsCorrectly() {
        Map<String, Object> cmsMap = entry("WordPress", 0.95);
        ReportDto.Tech tech = TechReportMapper.fromTechModuleData(techData(cmsMap, null, null));

        assertNotNull(tech);
        assertNotNull(tech.cms());
        assertEquals("WordPress", tech.cms().name());
        assertEquals(0.95, tech.cms().confidence());
        assertNull(tech.frontendFramework());
        assertNull(tech.nextJs());
    }

    @Test
    void shouldMapFrontendFrameworkCorrectly() {
        Map<String, Object> ffMap = entry("Vue.js", 0.8);
        ReportDto.Tech tech = TechReportMapper.fromTechModuleData(techData(null, ffMap, null));

        assertNotNull(tech);
        assertNull(tech.cms());
        assertNotNull(tech.frontendFramework());
        assertEquals("Vue.js", tech.frontendFramework().name());
        assertEquals(0.8, tech.frontendFramework().confidence());
    }

    @Test
    void shouldMapNextJsCorrectly() {
        Map<String, Object> nextMap = new LinkedHashMap<>();
        nextMap.put("isNext", true);
        nextMap.put("confidence", 0.99);
        nextMap.put("router", "app");
        nextMap.put("buildId", "abc123");

        ReportDto.Tech tech = TechReportMapper.fromTechModuleData(techData(null, null, nextMap));

        assertNotNull(tech);
        assertNull(tech.cms());
        assertNull(tech.frontendFramework());
        assertNotNull(tech.nextJs());
        assertTrue(tech.nextJs().isNext());
        assertEquals("app", tech.nextJs().router());
        assertEquals("abc123", tech.nextJs().buildId());
    }

    @Test
    void shouldMapCmsAndFfTogether() {
        Map<String, Object> cmsMap = entry("Strapi", 0.7);
        Map<String, Object> ffMap = entry("React", 0.85);

        ReportDto.Tech tech = TechReportMapper.fromTechModuleData(techData(cmsMap, ffMap, null));

        assertNotNull(tech);
        assertEquals("Strapi", tech.cms().name());
        assertEquals("React", tech.frontendFramework().name());
    }

    @Test
    void shouldReturnNullWhenEmptyCmsMapAndNoOtherTech() {
        // empty map for cms (name=null) and nothing else → all null → null Tech
        Map<String, Object> emptyCms = new LinkedHashMap<>();
        assertNull(TechReportMapper.fromTechModuleData(techData(emptyCms, null, null)));
    }
}
