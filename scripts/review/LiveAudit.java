import com.dokor.argos.services.analysis.*;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.modules.http.*;
import com.dokor.argos.services.analysis.modules.html.*;
import com.dokor.argos.services.analysis.modules.runtime.*;
import com.dokor.argos.services.analysis.modules.lighthouse.*;
import com.dokor.argos.services.analysis.modules.ssl.*;
import com.dokor.argos.services.analysis.modules.observatory.*;
import com.dokor.argos.services.analysis.modules.zap.*;
import com.dokor.argos.services.analysis.modules.tech.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.configuration.*;
import com.dokor.argos.services.domain.report.*;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.fasterxml.jackson.databind.*;
import com.typesafe.config.ConfigFactory;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import org.slf4j.*;

// Explicit manual review: real public collection, no queue/DB/account or production write.
public class LiveAudit {
  static Logger log = LoggerFactory.getLogger(LiveAudit.class);
  static List<AuditModuleResult> modules = new ArrayList<>();
  static List<String> unavailable = new ArrayList<>();
  static void collect(String name, Supplier<AuditModuleResult> action) {
    try { var result = action.get(); modules.add(result); System.out.println("COLLECTED " + name + " checks=" + result.checks().size()); }
    catch (Exception failure) {
      unavailable.add(name + ": " + failure.getClass().getSimpleName());
      modules.add(new AuditModuleResult(name, name, "Unavailable during live review", Map.of("available", false), List.of()));
      System.out.println("UNAVAILABLE " + name + " " + failure.getClass().getSimpleName());
    }
  }
  public static void main(String[] args) throws Exception {
    var demos = Map.of("w3c-bad", "https://www.w3.org/WAI/demos/bad/before/home.html",
      "js-error", "https://the-internet.herokuapp.com/javascript_error",
      "broken-images", "https://the-internet.herokuapp.com/broken_images",
      "mixed-content", "https://mixed.badssl.com/");
    boolean argos = args.length == 1 && args[0].equals("--run-public-argos");
    String demo = args.length == 2 && args[0].equals("--run-public-demo") ? args[1] : null;
    if (!argos && !demos.containsKey(demo == null ? "" : demo)) throw new IllegalArgumentException("Explicit --run-public-argos or --run-public-demo <known demo> required");
    String url = argos ? "https://argos.lelouet.fr/" : demos.get(demo);
    Path dir = argos ? Path.of("outputs/live-audit") : Path.of("outputs/live-audit", demo);
    Files.createDirectories(dir);
    UrlNormalizer.validatePublicUrl(url);
    var mapper = new ObjectMapper().findAndRegisterModules();
    var config = new ConfigurationService(ConfigFactory.parseString("external.playwright.url=\"http://127.0.0.1:3016\"\nexternal.lighthouse.url=\"http://127.0.0.1:3017\"\nexternal.zap.url=\"http://127.0.0.1:8080\"\nexternal.ssl-labs.timeout=90s"));
    var external = new ExternalHttpClient(mapper);
    var initial = new AuditContext(url, url, 0);
    var http = new HttpModuleAnalyzer().analyze(initial, log);
    var ctx = HttpModuleAnalyzer.enrichContext(initial, http);
    if (ctx.body() == null || ctx.httpStatusCode() != 200) throw new IllegalStateException("Real HTTP snapshot unavailable");
    var data = new LinkedHashMap<>(http.data()); data.remove("body");
    modules.add(new AuditModuleResult(http.id(), http.title(), http.summary(), data, http.checks()));
    collect("html", () -> new HtmlModuleAnalyzer().analyze(ctx, log));
    collect("runtime", () -> new RuntimeModuleAnalyzer(new PlaywrightRuntimeClient(mapper, external, config)).analyze(ctx, log));
    collect("lighthouse", () -> new LighthouseModuleAnalyzer(new LighthouseClient(mapper, external, config) {
      public JsonNode analyze(String target) throws Exception {
        var result = super.analyze(target);
        mapper.writerWithDefaultPrettyPrinter().writeValue(dir.resolve("lighthouse.json").toFile(), result);
        return result;
      }
    }).analyze(ctx, log));
    collect("ssl", () -> new SslLabsModuleAnalyzer(new SslLabsClient(external, config)).analyze(ctx, log));
    collect("observatory", () -> new ObservatoryModuleAnalyzer(new ObservatoryClient(external, config)).analyze(ctx, log));
    collect("zap", () -> new ZapModuleAnalyzer(new ZapClient(mapper, external, config)).analyze(ctx, log));
    collect("tech", () -> new TechModuleAnalyzer(new NextJsDetectorService()).analyze(ctx, log));
    var policy = new DefaultScorePolicy();
    var enricher = new ScoreEnricherService(policy);
    var enriched = enricher.enrich(new CheckMergerService().merge(modules));
    var score = new ScoreService(policy).compute(policy.version(), policy.fingerprint(), enriched);
    var states = new LinkedHashMap<String,String>();
    for (var module : modules) states.put(module.id(), Boolean.FALSE.equals(module.data().get("available")) ? "UNAVAILABLE" : Boolean.TRUE.equals(module.data().get("partial")) ? "PARTIAL" : "COMPLETED");
    var internal = new AuditReportJson(1, url, url, Instant.now(), Map.of("review", "real-collectors-no-database",
      "moduleStatuses", mapper.writeValueAsString(states), "completeness", String.valueOf(states.values().stream().filter("COMPLETED"::equals).count()*100/8)), enriched, score);
    var report = new PublicReportComposer().compose(internal);
    mapper.writerWithDefaultPrettyPrinter().writeValue(dir.resolve("report.json").toFile(), AuditOutputSanitizer.tree(report, mapper));
    mapper.writerWithDefaultPrettyPrinter().writeValue(dir.resolve("internal.json").toFile(), AuditOutputSanitizer.tree(internal, mapper));
    mapper.writerWithDefaultPrettyPrinter().writeValue(dir.resolve("provenance.json").toFile(), Map.of("target", url, "at", Instant.now().toString(), "unavailable", unavailable, "queueAndDatabase", false));
    System.out.println("REPORT findings=" + report.issues().size() + " unavailable=" + unavailable);
  }
}
