# Inventaire statique des règles

Généré par node scripts/report-rule-inventory.mjs depuis les analyseurs et la policy. Ne pas modifier manuellement. La clé renvoie aux textes FR/EN versionnés ; specific décrit une fiche détaillée, explicit-fallback indique que la méthode versionnée ou les éléments concernés restent à demander. Cela ne signifie pas une validation humaine.

Les littéraux sont inventoriés de manière conservatrice, y compris contrôles informatifs et stubs non publiés. La condition exacte de déclenchement et les détails disponibles sont dans la source référencée et les fiches findingPlaybooks.ts. Les ensembles ouverts lighthouse.audit.<id> (modes binary/numeric/metricSavings, score < 0,9, plafond 12) et zap.alert.<pluginId> sont traités par repli explicite. Leurs identifiants ne peuvent pas être énumérés à partir des seuls littéraux Java.

| Clé | Propriétaire | Poids catalogue | Fiche | Source et ligne |
| --- | --- | ---: | --- | --- |
| html.analysis.duration_ms | html | 1 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:178 |
| html.anchors.href_coverage | html | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:554 |
| html.collect | html | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| html.doctype.html5 | html | 1 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:409 |
| html.h1.count | html | 3 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:358 |
| html.images.alt_coverage | html | 4 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:495 |
| html.lang | html | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:376 |
| html.link.canonical.present | html | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:317 |
| html.meta.charset.present | html | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:425 |
| html.meta.description.present | html | 3 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:300 |
| html.meta.robots.present | html | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:124 |
| html.meta.viewport.present | html | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:393 |
| html.scripts.count | html | 1 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:148 |
| html.size.bytes | html | 1 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:163 |
| html.social.meta | html | 1 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:468 |
| html.title | html | 4 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/html/HtmlModuleAnalyzer.java:280 |
| http.antibot.challenge | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:205 |
| http.collect | http | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| http.errors | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:272 |
| http.final_url.https | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:513 |
| http.headers.caching | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:814 |
| http.headers.compression | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:788 |
| http.headers.content_type | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:596 |
| http.headers.server | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:831 |
| http.protocol.http2 | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:759 |
| http.protocol.version | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:256 |
| http.redirect.count | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:492 |
| http.redirect.to_https | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:552 |
| http.response_time_ms | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:574 |
| http.security.cookie_flags | http | 6 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:686 |
| http.security.csp | http | 10 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:625 |
| http.security.hsts | http | 8 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:616 |
| http.security.permissions_policy | http | 6 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:661 |
| http.security.referrer_policy | http | 3 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:652 |
| http.security.x_content_type_options | http | 4 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:634 |
| http.security.x_frame_options | http | 6 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:643 |
| http.seo.robots_txt | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:901 |
| http.seo.sitemap | http | 3 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:908 |
| http.status_code | http | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/http/HttpModuleAnalyzer.java:366 |
| lighthouse.collect | lighthouse | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| lighthouse.score.accessibility | lighthouse | 10 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/lighthouse/LighthouseModuleAnalyzer.java |
| lighthouse.score.best-practices | lighthouse | 6 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/lighthouse/LighthouseModuleAnalyzer.java |
| lighthouse.score.performance | lighthouse | 22 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/lighthouse/LighthouseModuleAnalyzer.java |
| lighthouse.score.seo | lighthouse | 8 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/lighthouse/LighthouseModuleAnalyzer.java |
| observatory.collect | observatory | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| observatory.grade | observatory | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/observatory/ObservatoryModuleAnalyzer.java:137 |
| observatory.score | observatory | 8 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/observatory/ObservatoryModuleAnalyzer.java:116 |
| observatory.tests.passed | observatory | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/observatory/ObservatoryModuleAnalyzer.java:159 |
| runtime.analysis.duration_ms | runtime | 4 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:191 |
| runtime.collect | runtime | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| runtime.console.errors | runtime | 5 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:20 |
| runtime.js.errors | runtime | 6 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:109 |
| runtime.network.5xx | runtime | 8 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:122 |
| runtime.network.bytes_estimated | runtime | 4 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:178 |
| runtime.network.failed_requests | runtime | 4 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:135 |
| runtime.network.request_count | runtime | 4 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:165 |
| runtime.network.third_party_errors | runtime | 0 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/runtime/RuntimeModuleAnalyzer.java:150 |
| ssl.certificate.expiry_days | ssl | 3 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/ssl/SslLabsModuleAnalyzer.java:236 |
| ssl.certificate.valid | ssl | 6 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/ssl/SslLabsModuleAnalyzer.java:104 |
| ssl.collect | ssl | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| ssl.grade | ssl | 10 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/ssl/SslLabsModuleAnalyzer.java:99 |
| ssl.protocols.legacy_disabled | ssl | 3 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/ssl/SslLabsModuleAnalyzer.java:102 |
| ssl.protocols.tls12 | ssl | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/ssl/SslLabsModuleAnalyzer.java:101 |
| ssl.protocols.tls13 | ssl | 2 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/ssl/SslLabsModuleAnalyzer.java:100 |
| tech.analysis.duration_ms | tech | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:304 |
| tech.backend.hints | tech | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:234 |
| tech.cdn.cloudflare | tech | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:249 |
| tech.cms | tech | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:130 |
| tech.collect | tech | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| tech.frontend.framework | tech | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:145 |
| tech.frontend.nextjs | tech | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:175 |
| tech.http.server_header | tech | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:264 |
| tech.security.version_disclosure | tech | 3 | specific-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/tech/TechModuleAnalyzer.java:285 |
| zap.collect | zap | 0 | explicit-fallback-fr-en | Availability stub from orchestrator |
| zap.scan.result | zap | 0 | explicit-fallback-fr-en | apps/api-backend/src/main/java/com/dokor/argos/services/analysis/modules/zap/ZapModuleAnalyzer.java:104 |
