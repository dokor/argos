package com.dokor.argos.services.domain.report;

/** Complete evidence is not the 80% sufficiency threshold or a high quality score. */
public final class ReportCompleteness {
    private ReportCompleteness() {}

    public static String from(ReportDto report) {
        if (report.scores() == null
                || report.scores().coverage() == null
                || report.scores().coverage().global() == null
                || report.scores().completeness() == null) return "UNKNOWN";
        var coverage = report.scores().coverage();
        var global = coverage.global();
        if (coverage.checks() == null || coverage.checks().isEmpty()) return "UNKNOWN";
        boolean missing =
                coverage.checks().stream()
                        .anyMatch(
                                c ->
                                        c.weight() > 0
                                                && (c.state() == null
                                                        || c.state()
                                                                == com.dokor.argos.services.analysis
                                                                        .scoring.MeasurementCoverage
                                                                        .State.UNAVAILABLE
                                                        || c.state()
                                                                == com.dokor.argos.services.analysis
                                                                        .scoring.MeasurementCoverage
                                                                        .State.BLOCKED_BY_ANTIBOT));
        return !missing
                        && global.available()
                        && global.expectedWeight() > 0
                        && Double.isFinite(global.ratio())
                        && global.ratio() >= 1
                        && report.scores().completeness() == 100
                ? "FULL"
                : "PARTIAL";
    }
}
