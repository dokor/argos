package com.dokor.argos.services.analysis;

import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.modules.tech.TechModuleAnalyzer;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

/** Each audit detects technologies from its own HTTP snapshot, without a persisted cache. */
@Singleton
public class DomainAnalysisService {
    private final TechModuleAnalyzer techModuleAnalyzer;

    @Inject
    public DomainAnalysisService(TechModuleAnalyzer techModuleAnalyzer) {
        this.techModuleAnalyzer = techModuleAnalyzer;
    }

    public AuditModuleResult runFreshTechAnalysis(AuditContext context, Logger logger) {
        return techModuleAnalyzer.analyze(context, logger);
    }
}
