package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.DomainAnalysisDao;
import com.dokor.argos.db.generated.DomainAnalysis;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.modules.tech.TechModuleAnalyzer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.sql.Connection;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DomainAnalysisServiceTest {

    @Test
    void freshTechResultUsesDomainCacheWithoutRunningAnalyzer() throws Exception {
        var dao = mock(DomainAnalysisDao.class);
        lockedDomain(dao);
        var analyzer = mock(TechModuleAnalyzer.class);
        var mapper = new ObjectMapper().findAndRegisterModules();
        var cached = new AuditModuleResult(AuditModule.TECH.id(), "Tech stack", "cached", Map.of(), List.of());
        var entity = new DomainAnalysis();
        entity.setDomainId(7L);
        entity.setResultJson(mapper.writeValueAsString(cached));
        when(dao.findFreshByDomainId(eq(7L), isNull())).thenReturn(Optional.of(entity));

        var result = new DomainAnalysisService(dao, analyzer, mapper)
            .getOrRunTechAnalysis(new AuditContext("https://example.com/a", "https://example.com/a", 7L),
                LoggerFactory.getLogger(getClass()));

        assertEquals(cached, result);
        verifyNoInteractions(analyzer);
        verify(dao, never()).save(any());
    }

    @Test
    void cacheMissRunsTechWithCurrentContextAndStoresResult() {
        var dao = mock(DomainAnalysisDao.class);
        lockedDomain(dao);
        var analyzer = mock(TechModuleAnalyzer.class);
        var context = new AuditContext("https://example.com/b", "https://example.com/b", 7L)
            .withHttpResult("https://example.com/final", 200, 1L, List.of(), Map.of(), "<h1>page</h1>");
        var result = new AuditModuleResult(AuditModule.TECH.id(), "Tech stack", "fresh", Map.of(), List.of());
        when(dao.findFreshByDomainId(eq(7L), isNull())).thenReturn(Optional.empty());
        when(analyzer.analyze(eq(context), any())).thenReturn(result);

        assertEquals(result, new DomainAnalysisService(dao, analyzer, new ObjectMapper().findAndRegisterModules())
            .getOrRunTechAnalysis(context, LoggerFactory.getLogger(getClass())));
        verify(analyzer).analyze(eq(context), any());
        verify(dao).save(any(DomainAnalysis.class), isNull());
    }

    @Test
    void corruptCacheIsDeletedAndRecalculated() {
        var dao = mock(DomainAnalysisDao.class);
        lockedDomain(dao);
        var analyzer = mock(TechModuleAnalyzer.class);
        var entity = new DomainAnalysis();
        entity.setDomainId(7L);
        entity.setResultJson("{broken json");
        var result = new AuditModuleResult(AuditModule.TECH.id(), "Tech stack", "fresh", Map.of(), List.of());
        when(dao.findFreshByDomainId(eq(7L), isNull())).thenReturn(Optional.of(entity));
        when(analyzer.analyze(any(), any())).thenReturn(result);

        assertEquals(result, new DomainAnalysisService(dao, analyzer, new ObjectMapper().findAndRegisterModules())
            .getOrRunTechAnalysis(context(), LoggerFactory.getLogger(getClass())));
        verify(dao, times(2)).deleteByDomainId(eq(7L), isNull());
        verify(dao).save(any(DomainAnalysis.class), isNull());
    }

    @Test
    void failedRecalculationDeletesCorruptCacheWithoutSavingFalseSuccess() {
        var dao = mock(DomainAnalysisDao.class);
        lockedDomain(dao);
        var analyzer = mock(TechModuleAnalyzer.class);
        var entity = new DomainAnalysis();
        entity.setDomainId(7L);
        entity.setResultJson("{}");
        when(dao.findFreshByDomainId(eq(7L), isNull())).thenReturn(Optional.of(entity));
        when(analyzer.analyze(any(), any())).thenThrow(new IllegalStateException("analysis failed"));

        assertThrows(IllegalStateException.class, () ->
            new DomainAnalysisService(dao, analyzer, new ObjectMapper().findAndRegisterModules())
                .getOrRunTechAnalysis(context(), LoggerFactory.getLogger(getClass())));
        verify(dao).deleteByDomainId(eq(7L), isNull());
        verify(dao, never()).save(any(DomainAnalysis.class), any());
    }

    private static AuditContext context() {
        return new AuditContext("https://example.com/a", "https://example.com/a", 7L);
    }

    @SuppressWarnings("unchecked")
    private static void lockedDomain(DomainAnalysisDao dao) {
        when(dao.withLockedDomain(eq(7L), any())).thenAnswer(call ->
            ((Function<Connection, ?>) call.getArgument(1)).apply(null));
    }
}
