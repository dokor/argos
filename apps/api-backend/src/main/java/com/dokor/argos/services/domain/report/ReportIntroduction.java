package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.account.AccountError;
import java.util.*;

/** Published text only: no account identifiers, drafts, internal notes or contact data. */
public record ReportIntroduction(String author, String context, List<String> findingKeys,
                                 String nextStep, String publishedAt) {
    public static ReportIntroduction prepare(ReportIntroduction input, ReportDto report, String date) {
        if (input == null || input.findingKeys == null) throw new AccountError(400, "introduction_invalid");
        var keys = new LinkedHashSet<>(input.findingKeys);
        var available = new HashSet<String>();
        if (report.issues() != null) report.issues().forEach(issue -> { if (issue.id() != null) available.add(issue.id()); });
        if (keys.size() < 2 || keys.size() > 3 || keys.size() != input.findingKeys.size()
            || keys.stream().anyMatch(key -> key == null || key.length() > 200 || !key.matches("[A-Za-z0-9_.-]+"))
            || !available.containsAll(keys)) throw new AccountError(400, "introduction_findings_invalid");
        return new ReportIntroduction(text(input.author, 120), text(input.context, 1200),
            List.copyOf(keys), text(input.nextStep, 500), date);
    }
    private static String text(String value, int max) {
        if (value == null || value.isBlank() || value.length() > max
            || value.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\t'))
            throw new AccountError(400, "introduction_invalid");
        return value.strip();
    }
}
