package com.dokor.argos.services.domain.report;

import java.util.List;
import java.util.Map;
import static com.dokor.argos.services.domain.report.TechReportValues.*;

public final class TechReportMapper {

    private TechReportMapper() {}

    public static ReportDto.Tech fromTechModuleData(Map<String, Object> techData) {
        if (techData == null || techData.isEmpty()) return null;

        Map<String, Object> cmsMap = asMap(techData.get("cms"));
        Map<String, Object> ffMap = asMap(techData.get("frontendFramework"));
        Map<String, Object> nextMap = asMap(techData.get("nextJs"));

        // Cms: empty map (no CMS detected) => name is null => treat as absent
        String cmsName = cmsMap == null ? null : asString(cmsMap.get("name"));
        ReportDto.Cms cms = (cmsName != null) ? new ReportDto.Cms(cmsName, asDouble(cmsMap.get("confidence"))) : null;

        // FrontendFramework: "unknown" means no framework detected => treat as absent
        String ffName = ffMap == null ? null : asString(ffMap.get("name"));
        ReportDto.FrontendFramework ff = (ffName != null && !ffName.equals("unknown"))
            ? new ReportDto.FrontendFramework(ffName, asDouble(ffMap.get("confidence")))
            : null;

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

            // evidence peut être dans nextJs.evidence (si tu l'y mets)
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
}
