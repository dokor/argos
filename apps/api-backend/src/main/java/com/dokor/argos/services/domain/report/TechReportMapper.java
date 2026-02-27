package com.dokor.argos.services.domain.report;

import java.util.*;
import static java.util.Collections.emptyList;

public final class TechReportMapper {

    private TechReportMapper() {}

    @SuppressWarnings("unchecked")
    public static ReportDto.Tech fromTechModuleData(Map<String, Object> techData) {
        if (techData == null || techData.isEmpty()) return null;

        Map<String, Object> cmsMap = asMap(techData.get("cms"));
        Map<String, Object> ffMap = asMap(techData.get("frontendFramework"));
        Map<String, Object> nextMap = asMap(techData.get("nextJs"));

        ReportDto.Cms cms = cmsMap == null ? null : new ReportDto.Cms(
            asString(cmsMap.get("name")),
            asDouble(cmsMap.get("confidence"))
        );

        ReportDto.FrontendFramework ff = ffMap == null ? null : new ReportDto.FrontendFramework(
            asString(ffMap.get("name")),
            asDouble(ffMap.get("confidence"))
        );

        ReportDto.NextJs next = null;
        if (nextMap != null) {
            Map<String, Object> versionMap = asMap(nextMap.get("version"));

            ReportDto.NextJsVersion version = versionMap == null ? null : new ReportDto.NextJsVersion(
                asString(versionMap.get("exact")),
                asString(versionMap.get("min")),
                asString(versionMap.get("max")),
                asString(versionMap.get("guess")),
                asDouble(versionMap.get("guessConfidence")),
                asString(versionMap.get("method"))
            );

            // evidence peut être dans nextJs.evidence (si tu l’y mets)
            List<String> evidence = asStringList(nextMap.get("evidence"));

            next = new ReportDto.NextJs(
                asBoolean(nextMap.get("isNext")),
                asDouble(nextMap.get("confidence")),
                asString(nextMap.get("router")),
                asString(nextMap.get("buildId")),
                version,
                evidence
            );
        }

        // si tout est null => pas de tech utile
        if (cms == null && ff == null && next == null) return null;

        return new ReportDto.Tech(cms, ff, next);
    }

    private static Map<String, Object> asMap(Object o) {
        if (o instanceof Map<?, ?> m) {
            Map<String, Object> out = new LinkedHashMap<>();
            m.forEach((k, v) -> out.put(String.valueOf(k), v));
            return out;
        }
        return null;
    }

    private static String asString(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Double asDouble(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o)); }
        catch (Exception e) { return null; }
    }

    private static Boolean asBoolean(Object o) {
        if (o == null) return null;
        if (o instanceof Boolean b) return b;
        String s = String.valueOf(o).trim().toLowerCase(Locale.ROOT);
        if (s.equals("true")) return true;
        if (s.equals("false")) return false;
        return null;
    }

    @SuppressWarnings("unchecked")
    private static List<String> asStringList(Object o) {
        if (o == null) return emptyList();
        if (o instanceof List<?> list) {
            List<String> out = new ArrayList<>();
            for (Object item : list) {
                if (item != null) out.add(String.valueOf(item));
            }
            return out;
        }
        return emptyList();
    }
}
