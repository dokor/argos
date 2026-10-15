package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.AuditReportJson;
import java.util.*;

/** Independent of failed/scorable findings: successful measurements must remain visible. */
public record ObservedMeasurements(Double lcpMs, Double fcpMs, Double responseMs, Double loadMs,
    Double transferredBytes, Double requests, Double htmlBytes, Double scripts,
    Double jsErrors, Double consoleErrors, Double failedRequests, Double http4xx, Double http5xx) {
    public static ObservedMeasurements from(AuditReportJson report) {
        Map<String, Map<String,Object>> data = new HashMap<>();
        if (report.modules() != null) for (var module : report.modules()) {
            var values = module.data();
            if (values != null && !Boolean.FALSE.equals(values.get("available"))
                && !"UNAVAILABLE".equals(values.get("measurementState"))
                && !"BLOCKED_BY_ANTIBOT".equals(values.get("measurementState"))) data.put(module.id(), values);
        }
        var runtime = data.get("runtime"); var http = data.get("http"); var html = data.get("html"); var lighthouse = data.get("lighthouse");
        return new ObservedMeasurements(number(lighthouse,"observedMetrics","lcpMs"),number(lighthouse,"observedMetrics","fcpMs"),
            http != null && Boolean.TRUE.equals(http.get("responseSnapshotAvailable")) ? number(http,"durationMs") : null,
            number(runtime,"timings","loadMs"),number(runtime,"network","totalBytesEstimated"),number(runtime,"network","requests"),
            number(html,"htmlBytes"),number(html,"scriptCount"),number(runtime,"jsErrors","count"),number(runtime,"console","errors"),
            number(runtime,"network","failedRequests"),number(runtime,"network","status4xx"),number(runtime,"network","status5xx"));
    }
    static Double number(Map<String,?> data, String... path) {
        Object value=data;
        for (String key:path) value=value instanceof Map<?,?> map ? map.get(key) : null;
        return value instanceof Number n && Double.isFinite(n.doubleValue()) && n.doubleValue() >= 0 ? n.doubleValue() : null;
    }
}
