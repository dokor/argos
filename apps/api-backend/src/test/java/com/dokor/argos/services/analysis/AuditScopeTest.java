package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.runtime.RuntimeModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.lighthouse.LighthouseModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.observatory.ObservatoryModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.ssl.SslLabsModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.zap.ZapModuleAnalyzer;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.report.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditScopeTest {
    private final DefaultScorePolicy policy = new DefaultScorePolicy();
    private final AuditScopeCatalogue catalogue = new AuditScopeCatalogue(policy);
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private static AuditModuleResult module(String id, String key) {
        return new AuditModuleResult(id,id,"",Map.of(),List.of(AuditCheckResult.of(key,key,AuditStatus.FAIL,AuditSeverity.MEDIUM,false,0,List.of(),null,Map.of(),"observation",null)));
    }
    @Test void categoryUsesEverySourceAndHttpContext() {
        assertEquals(Set.of(AuditModule.HTTP,AuditModule.HTML,AuditModule.LIGHTHOUSE),catalogue.modules(new AuditScope("category","seo")));
        assertEquals(Set.of(AuditModule.HTTP,AuditModule.HTML,AuditModule.LIGHTHOUSE),catalogue.modules(new AuditScope("category","a11y")));
        assertTrue(catalogue.modules(new AuditScope("category","security")).containsAll(Set.of(AuditModule.HTTP,AuditModule.TECH,AuditModule.SSL,AuditModule.OBSERVATORY,AuditModule.ZAP,AuditModule.LIGHTHOUSE)));
        assertEquals(Set.of(AuditModule.HTTP,AuditModule.HTML),catalogue.modules(new AuditScope("check","html.title")));
        assertEquals(Set.of(AuditModule.HTTP,AuditModule.LIGHTHOUSE),catalogue.modules(new AuditScope("check","lighthouse.audit.color-contrast")));
        assertEquals(EnumSet.allOf(AuditModule.class),catalogue.modules(null));
        assertThrows(IllegalArgumentException.class,()->catalogue.modules(new AuditScope("category","ssl")));
        assertThrows(IllegalArgumentException.class,()->catalogue.modules(new AuditScope("check","html.invented")));
        assertThrows(IllegalArgumentException.class,()->catalogue.modules(new AuditScope("check","http.collect")));
        assertThrows(IllegalArgumentException.class,()->new AuditScope("full","html.title"));
    }
    @Test void selectKeepsOnlyRequestedChecksAndFailureEvidence() {
        var modules=List.of(module("http","http.security.csp"),module("html","html.title"),module("lighthouse","lighthouse.collect"));
        var selected=catalogue.select(new AuditScope("category","seo"),modules);
        assertTrue(selected.getFirst().checks().isEmpty());
        assertEquals("html.title",selected.get(1).checks().getFirst().key());
        assertEquals("lighthouse.collect",selected.get(2).checks().getFirst().key());
    }
    @Test void scopeChangesComparabilityWithoutChangingFullHistory() {
        String url="https://example.com/";
        assertEquals(MeasurementContract.scope(url,url),MeasurementContract.scope(url,url,AuditScope.full()));
        assertNotEquals(MeasurementContract.scope(url,url),MeasurementContract.scope(url,url,new AuditScope("category","seo")));
        assertNotEquals(MeasurementContract.scope(url,url,new AuditScope("category","seo")),MeasurementContract.scope(url,url,new AuditScope("check","html.title")));
    }
    @Test void processorRunsOnlyHtmlAndFreshHttpAndScoresOnlyTitle() throws Exception {
        Fixture f=new Fixture(new AuditScope("check","html.title"));
        when(f.html.analyze(any(),any())).thenAnswer(invocation->{
            AuditContext context=invocation.getArgument(0);
            assertEquals("<title>Fresh</title>",context.body());
            assertEquals("https://example.com/final",context.finalUrl());
            return module("html","html.title");
        });
        f.processor.process(1);
        var report=f.published();
        assertEquals(List.of("html.title"),report.score().checks().stream().filter(c->c.weight()>0).map(ScoredCheck::key).toList());
        assertTrue(report.score().coverage().provisional());
        assertEquals("SKIPPED",mapper.readTree(report.meta().get("moduleStatuses")).get("runtime").asText());
        assertEquals("[]",report.meta().get("reusedCheckKeys"));
        ReportDto dto=new PublicReportComposer().compose(report);
        assertEquals("check",dto.scores().scope().kind());
        assertEquals(dto.scores().scope(),dto.publicSummary().scores().scope());
        verifyNoInteractions(f.runtime,f.lighthouse,f.ssl,f.observatory,f.zap,f.tech);
    }
    @Test void categoryFailurePublishesPartialWithoutInventingTitleOrScore() throws Exception {
        Fixture f=new Fixture(new AuditScope("category","seo"));
        when(f.html.analyze(any(),any())).thenThrow(new ModuleUnavailableException("unavailable"));
        when(f.lighthouse.analyze(any(),any())).thenReturn(new AuditModuleResult("lighthouse","Lighthouse","",Map.of(),List.of()));
        f.processor.process(1);
        var report=f.published();
        assertTrue(report.score().checks().stream().noneMatch(c->"html.title".equals(c.key())));
        assertEquals(0,report.score().global().maxScore());
        assertTrue(report.score().coverage().checks().stream().anyMatch(c->"html.title".equals(c.key())&&c.state()==MeasurementCoverage.State.UNAVAILABLE));
        assertEquals("UNAVAILABLE",mapper.readTree(report.meta().get("moduleStatuses")).get("html").asText());
        verifyNoInteractions(f.runtime,f.ssl,f.observatory,f.zap,f.tech);
    }
    @Test void targetedTechBypassesStackCache() throws Exception {
        Fixture f=new Fixture(new AuditScope("check","tech.cms"));
        when(f.tech.runFreshTechAnalysis(any(),any())).thenReturn(module("tech","tech.cms"));
        f.processor.process(1);
        assertEquals("[]",f.published().meta().get("reusedCheckKeys"));
        verify(f.tech).runFreshTechAnalysis(any(),any());
        verify(f.tech,never()).getOrRunTechAnalysis(any(),any());
    }
    @Test void fullRerunExecutesAllEnginesAndTracesTheExistingStackCache() throws Exception {
        Fixture f=new Fixture(AuditScope.full());
        when(f.html.analyze(any(),any())).thenReturn(module("html","html.title"));
        when(f.runtime.analyze(any(),any())).thenReturn(module("runtime","runtime.console.errors"));
        when(f.lighthouse.analyze(any(),any())).thenReturn(module("lighthouse","lighthouse.score.seo"));
        when(f.observatory.analyze(any(),any())).thenReturn(module("observatory","observatory.score"));
        when(f.ssl.analyze(any(),any())).thenReturn(module("ssl","ssl.grade"));
        when(f.zap.analyze(any(),any())).thenReturn(module("zap","zap.alert.10038"));
        when(f.tech.getOrRunTechAnalysis(any(),any())).thenReturn(new AuditModuleResult("tech","Tech","",
            Map.of("stackCache",Map.of("hit",true,"checkKeys",List.of("tech.cms"))),module("tech","tech.cms").checks()));
        f.processor.process(1);
        var report=f.published();
        assertEquals(8,report.modules().size());assertEquals("false",report.meta().get("partialScope"));
        assertEquals(List.of("tech.cms"),mapper.readValue(report.meta().get("reusedCheckKeys"),List.class));
        assertFalse(mapper.readValue(report.meta().get("newCheckKeys"),List.class).contains("tech.cms"));
        verify(f.tech,never()).runFreshTechAnalysis(any(),any());
    }
    private class Fixture {
        final AuditRunService runs=mock(AuditRunService.class);
        final AuditDao audits=mock(AuditDao.class);
        final HttpModuleAnalyzer http=mock(HttpModuleAnalyzer.class);
        final HtmlModuleAnalyzer html=mock(HtmlModuleAnalyzer.class);
        final RuntimeModuleAnalyzer runtime=mock(RuntimeModuleAnalyzer.class);
        final LighthouseModuleAnalyzer lighthouse=mock(LighthouseModuleAnalyzer.class);
        final ObservatoryModuleAnalyzer observatory=mock(ObservatoryModuleAnalyzer.class);
        final SslLabsModuleAnalyzer ssl=mock(SslLabsModuleAnalyzer.class);
        final ZapModuleAnalyzer zap=mock(ZapModuleAnalyzer.class);
        final DomainAnalysisService tech=mock(DomainAnalysisService.class);
        final ReportPublishService publication=mock(ReportPublishService.class);
        final AuditProcessorService processor;
        Fixture(AuditScope scope) throws Exception {
            var run=new AuditRun();run.setId(1L);run.setAuditId(2L);run.setExecutionScope(mapper.writeValueAsString(scope));
            var audit=new Audit();audit.setId(2L);audit.setDomainId(3L);audit.setInputUrl("https://example.com/");audit.setNormalizedUrl("https://example.com/");
            when(runs.getRun(1)).thenReturn(Optional.of(run));when(audits.findById(2L)).thenReturn(audit);
            when(http.analyze(any(),any())).thenReturn(new AuditModuleResult("http","HTTP","",Map.of("body","<title>Fresh</title>","finalUrl","https://example.com/final","statusCode",200),List.of()));
            processor=new AuditProcessorService(runs,audits,mock(UrlNormalizer.class),http,html,runtime,lighthouse,observatory,ssl,zap,tech,new CheckMergerService(),new ScoreEnricherService(policy),new ScoreService(policy),mapper,publication);
        }
        AuditReportJson published() {
            var captured=ArgumentCaptor.forClass(AuditReportJson.class);
            verify(publication).completeAndPublish(eq(1L),any(),captured.capture(),anyString(),nullable(String.class));
            return captured.getValue();
        }
    }
}
