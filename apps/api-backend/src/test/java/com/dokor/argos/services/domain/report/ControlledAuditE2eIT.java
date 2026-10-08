package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.coreoz.plume.jersey.errors.WsJacksonJsonProvider;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.services.analysis.*;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.runtime.*;
import com.dokor.argos.services.analysis.modules.lighthouse.*;
import com.dokor.argos.services.analysis.modules.observatory.*;
import com.dokor.argos.services.analysis.modules.ssl.*;
import com.dokor.argos.services.analysis.modules.zap.*;
import com.dokor.argos.services.analysis.modules.tech.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.domain.DomainService;
import com.dokor.argos.services.scheduler.AuditQueueService;
import com.dokor.argos.webservices.api.audits.*;
import com.dokor.argos.webservices.api.report.ReportsWs;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import com.sun.net.httpserver.HttpServer;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.grizzly.threadpool.ThreadPoolConfig;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real HTTP/Jersey, DAO claims/publication, browser UI and headless collectors on controlled sites. */
@EnabledIfEnvironmentVariable(named="ARGOS_E2E",matches="true")
class ControlledAuditE2eIT extends MariaDbReportFixture {
    private static final String PUBLIC_FIXTURE="http://203.0.113.10:3020";
    private static String local(String target) {
        if(!target.startsWith(PUBLIC_FIXTURE+"/")) throw new IllegalArgumentException("Only the controlled fixture transport may be mapped");
        return "http://127.0.0.1:3020"+URI.create(target).getRawPath();
    }
    @Test @Timeout(value=9,unit=TimeUnit.MINUTES) void submitProgressPublishAndPrivateReadAcrossControlledScenarios() throws Exception {
        sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE status='QUEUED'");
        var samples=HttpServer.create(new InetSocketAddress("127.0.0.1",3020),0);
        var sampleWorkers=Executors.newCachedThreadPool();samples.setExecutor(sampleWorkers);
        samples.createContext("/",exchange -> {
            String path=exchange.getRequestURI().getPath();
            if(path.equals("/redirect")) {exchange.getResponseHeaders().set("Location",PUBLIC_FIXTURE+"/healthy");exchange.sendResponseHeaders(302,-1);exchange.close();return;}
            if(path.equals("/timeout")) {try{Thread.sleep(35000);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();} }
            else if(!Set.of("/robots.txt","/sitemap.xml","/favicon.ico","/missing.png").contains(path)) {
                // Keep the RUNNING UI observable even when both collectors fail immediately.
                try {Thread.sleep(1800);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}
            }
            int status=path.equals("/antibot")?403:200;
            exchange.getResponseHeaders().set("Content-Type","text/html; charset=utf-8");
            exchange.getResponseHeaders().set("X-Content-Type-Options","nosniff");
            if(path.equals("/antibot")) {
                exchange.getResponseHeaders().set("Server","cloudflare");
                // Explicit challenge evidence; a CDN header and generic wording are insufficient.
                exchange.getResponseHeaders().set("cf-mitigated","challenge");
            }
            String body="<!doctype html><html lang='fr'><head><title>Controlled Argos fixture</title><meta name='description' content='Page locale contrôlée'><meta name='viewport' content='width=device-width'><meta charset='utf-8'></head><body><main><h1>Controlled fixture</h1><p>Local fixture content.</p>";
            if(path.equals("/errors")) body+="<img src='/missing.png'><script>console.error('Synthetic fixture error');throw new Error('Synthetic fixture error')</script>";
            if(path.equals("/antibot")) body+="<p>Just a moment… Verify you are human</p>";
            body+="</main></body></html>";
            if(path.equals("/robots.txt")) body="User-agent: *\nAllow: /\nSitemap: "+PUBLIC_FIXTURE+"/sitemap.xml";
            if(path.equals("/sitemap.xml")) {exchange.getResponseHeaders().set("Content-Type","application/xml");body="<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>"+PUBLIC_FIXTURE+"/healthy</loc></url></urlset>";}
            byte[] bytes=body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            try {exchange.sendResponseHeaders(status,bytes.length);exchange.getResponseBody().write(bytes);}finally{exchange.close();}
        });samples.start();
        var tx=new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT));
        var auditDao=new AuditDao(tx);var runDao=new AuditRunDao(tx);
        var policy=new DefaultScorePolicy();var urls=new UrlNormalizer();
        // The production validator sees a literal documentation IP (no third-party DNS).
        // A fixture-only transport adapter maps that exact origin onto the local sample server.
        var http=mock(HttpClient.class);var transport=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
        when(http.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenAnswer(call -> {
            HttpRequest original=call.getArgument(0);var request=HttpRequest.newBuilder(URI.create(local(original.uri().toString()))).timeout(original.timeout().orElse(Duration.ofSeconds(20))).GET();
            original.headers().map().forEach((name,values)->values.forEach(value->request.header(name,value)));
            return transport.send(request.build(),call.getArgument(1));
        });
        var constructor=HttpModuleAnalyzer.class.getDeclaredConstructor(HttpClient.class);constructor.setAccessible(true);
        var httpAnalyzer=constructor.newInstance(http);
        var runtimeTransport=new PlaywrightRuntimeClient(mapper);var runtime=mock(PlaywrightRuntimeClient.class);
        when(runtime.analyzeRuntime(anyString())).thenAnswer(call -> runtimeTransport.analyzeRuntime(local(call.getArgument(0))));
        var lighthouseTransport=new LighthouseClient(mapper);var lighthouse=mock(LighthouseClient.class);
        when(lighthouse.analyze(anyString())).thenAnswer(call -> lighthouseTransport.analyze(local(call.getArgument(0))));
        var ssl=mock(SslLabsClient.class);when(ssl.analyze(anyString())).thenReturn(mapper.readTree("{\"status\":\"READY\",\"endpoints\":[{\"grade\":\"A\",\"details\":{\"cert\":{\"issues\":0,\"notAfter\":4102444800000},\"protocols\":[{\"name\":\"TLS\",\"version\":\"1.2\"},{\"name\":\"TLS\",\"version\":\"1.3\"}]}}]}"));
        var observatory=mock(ObservatoryClient.class);when(observatory.scan(anyString())).thenReturn(mapper.readTree("{\"score\":100,\"grade\":\"A+\",\"tests_passed\":10,\"tests_failed\":0,\"tests_quantity\":10}"));
        var zap=mock(ZapClient.class);when(zap.analyze(org.mockito.ArgumentMatchers.any(com.dokor.argos.services.analysis.model.AuditContext.class))).thenReturn(mapper.readTree("{\"alerts\":[]}"));
        var summary=mock(AiReportSummaryService.class);when(summary.enrich(any())).thenAnswer(call->call.getArgument(0));
        var publish=new ReportPublishService(tx,runDao,reports,new PublicReportComposer(),summary,mock(AhrefsDomainRatingClient.class),mapper);
        var processor=new AuditProcessorService(runs,auditDao,urls,httpAnalyzer,new HtmlModuleAnalyzer(),new RuntimeModuleAnalyzer(runtime),new LighthouseModuleAnalyzer(lighthouse),new ObservatoryModuleAnalyzer(observatory),new SslLabsModuleAnalyzer(ssl),new ZapModuleAnalyzer(zap),
            new DomainAnalysisService(new DomainAnalysisDao(tx),new TechModuleAnalyzer(new NextJsDetectorService()),mapper),new CheckMergerService(),new ScoreEnricherService(policy),new ScoreService(policy),mapper,publish);
        var audits=new AuditService(auditDao,runs,urls,new DomainService(new DomainDao(tx)));
        var queue=new AuditQueueService(runs,processor);
        var settings=mock(ConfigurationService.class);when(settings.adminApiToken()).thenReturn("synthetic-e2e-admin");
        var json=new WsJacksonJsonProvider();json.setMapper(mapper);
        var api=GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:8081/api/"),new ResourceConfig().register(json).register(new AuditsWs(audits,new AuditQueryService(auditDao,runs,mapper),new AdminReadAccess(settings),reader)).register(new ReportsWs(reader,runs)),false);
        for(var listener:api.getListeners()) {listener.getTransport().setSelectorRunnersCount(1);listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(4).setMaxPoolSize(8));}api.start();
        var workers=Executors.newScheduledThreadPool(2);var failures=new ConcurrentLinkedQueue<Throwable>();
        Runnable tick=()->{try{queue.processNextQueuedRun();}catch(Throwable failure){failures.add(failure);}};
        workers.scheduleWithFixedDelay(tick,3,1,TimeUnit.SECONDS);workers.scheduleWithFixedDelay(tick,3,1,TimeUnit.SECONDS);
        Process browser=null;
        try {
            var root=Path.of(System.getProperty("user.dir")).toAbsolutePath();if(root.getFileName().toString().equals("api-backend")) root=root.getParent().getParent();
            var evidence=root.resolve("outputs/controlled-e2e.json");Files.createDirectories(evidence.getParent());
            browser=new ProcessBuilder("node",root.resolve("scripts/e2e/browser.mjs").toString()).directory(root.toFile()).redirectOutput(evidence.toFile()).redirectError(root.resolve("outputs/controlled-e2e-error.log").toFile()).start();
            assertTrue(browser.waitFor(8,TimeUnit.MINUTES),"Controlled browser suite must terminate");assertEquals(0,browser.exitValue(),"Controlled browser assertions must pass; sanitized diagnostics in outputs");assertTrue(failures.isEmpty(),"Workers must not fail outside module degradation");
            try(var connection=source.getConnection();var statement=connection.createStatement();var result=statement.executeQuery("SELECT COUNT(*),COUNT(DISTINCT r.run_id),MIN(ar.attempt_count),MAX(ar.attempt_count) FROM ARG_AUDIT_REPORT r JOIN ARG_AUDIT_RUN ar ON ar.id=r.run_id JOIN ARG_AUDIT a ON a.id=ar.audit_id WHERE a.normalized_url LIKE 'http://203.0.113.10:3020/%'")) {
                assertTrue(result.next());assertEquals(8,result.getInt(1));assertEquals(8,result.getInt(2));assertEquals(1,result.getInt(3));assertEquals(1,result.getInt(4));
            }
        } finally {if(browser!=null && browser.isAlive()) browser.destroyForcibly();workers.shutdownNow();workers.awaitTermination(10,TimeUnit.SECONDS);api.shutdownNow();samples.stop(0);sampleWorkers.shutdownNow();}
    }
}
