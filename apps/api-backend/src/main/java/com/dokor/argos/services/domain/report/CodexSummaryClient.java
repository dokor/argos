package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.configuration.ConfigurationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Singleton
public class CodexSummaryClient {

    private static final Logger logger = LoggerFactory.getLogger(CodexSummaryClient.class);

    private final ConfigurationService configuration;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Inject
    public CodexSummaryClient(ConfigurationService configuration, ObjectMapper objectMapper) {
        this.configuration = configuration;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    }

    public Optional<ReportDto.AiSummary> summarize(ReportDto report) {
        if (!configuration.codexSummaryEnabled()) {
            return Optional.empty();
        }

        try {
            String payload = objectMapper.writeValueAsString(buildInput(report));
            ObjectNode request = objectMapper.createObjectNode();
            request.put("prompt", buildPrompt(payload));
            request.set("schema", buildSchema());

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(configuration.codexSummaryServiceUrl() + "/run"))
                .timeout(configuration.codexSummaryTimeout())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(request)))
                .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("Codex summary unavailable status={}", response.statusCode());
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode structured = root.get("structuredOutput");
            if (structured == null || !structured.isObject()) {
                logger.warn("Codex summary response missing structuredOutput");
                return Optional.empty();
            }

            ReportDto.AiSummary summary = objectMapper.treeToValue(structured, ReportDto.AiSummary.class);
            if (!isValid(summary)) {
                logger.warn("Codex summary response failed validation");
                return Optional.empty();
            }

            return Optional.of(summary);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.warn("Codex summary interrupted");
            return Optional.empty();
        } catch (Exception e) {
            logger.warn("Codex summary failed error={}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private Map<String, Object> buildInput(ReportDto report) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("domain", report.domain());
        input.put("scores", report.scores());
        input.put("priorities", report.summary().priorities());
        input.put("issues", report.issues().stream()
            .limit(12)
            .map(this::issueInput)
            .toList());
        input.put("tech", report.tech());
        input.put("antiBot", report.antiBot());
        return input;
    }

    private Map<String, Object> issueInput(ReportDto.Issue issue) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("severity", issue.severity());
        value.put("category", issue.categoryKey());
        value.put("title", issue.title());
        value.put("impact", issue.impact());
        value.put("recommendation", issue.recommendation());
        return value;
    }

    private String buildPrompt(String reportJson) {
        return """
            Tu synthétises un rapport technique Argos pour un décideur non technique.

            Règles impératives :
            - utilise uniquement les données fournies ;
            - n'invente aucune vulnérabilité, métrique, cause ou recommandation ;
            - distingue les constats mesurés des recommandations ;
            - priorise l'impact business et utilisateur ;
            - reste concis ;
            - retourne une version française ET anglaise ;
            - 3 points clés maximum par langue.

            Données Argos :
            %s
            """.formatted(reportJson);
    }

    private JsonNode buildSchema() {
        String schema = """
            {
              "type": "object",
              "properties": {
                "fr": { "$ref": "#/$defs/locale" },
                "en": { "$ref": "#/$defs/locale" }
              },
              "required": ["fr", "en"],
              "additionalProperties": false,
              "$defs": {
                "locale": {
                  "type": "object",
                  "properties": {
                    "headline": { "type": "string", "minLength": 1, "maxLength": 140 },
                    "summary": { "type": "string", "minLength": 1, "maxLength": 900 },
                    "keyPoints": {
                      "type": "array",
                      "minItems": 1,
                      "maxItems": 3,
                      "items": { "type": "string", "minLength": 1, "maxLength": 220 }
                    }
                  },
                  "required": ["headline", "summary", "keyPoints"],
                  "additionalProperties": false
                }
              }
            }
            """;
        try {
            return objectMapper.readTree(schema);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid embedded Codex summary schema", e);
        }
    }

    private boolean isValid(ReportDto.AiSummary summary) {
        return summary != null && validLocale(summary.fr()) && validLocale(summary.en());
    }

    private boolean validLocale(ReportDto.AiSummaryLocale locale) {
        return locale != null
            && locale.headline() != null && !locale.headline().isBlank()
            && locale.summary() != null && !locale.summary().isBlank()
            && locale.keyPoints() != null && !locale.keyPoints().isEmpty()
            && locale.keyPoints().stream().allMatch(point -> point != null && !point.isBlank());
    }
}
