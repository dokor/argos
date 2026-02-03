package com.dokor.argos.services.domain;

import com.dokor.argos.services.domain.enums.AuditRunStatus;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
import com.dokor.argos.webservices.api.audits.data.CreateAuditResponse;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;

@Singleton
public class AuditService {
    private static final Logger logger = LoggerFactory.getLogger(AuditService.class);

    @Inject
    public AuditService() {

    }

    public CreateAuditResponse createAuditOfUrl(@NotBlank String url) {
        return new CreateAuditResponse( //todo : brancher au workflow app
            0L,
            0L,
            AuditRunStatus.QUEUED
        );
    }

    public AuditRunStatusResponse getRunStatusOfId(String runId) {
        return new AuditRunStatusResponse( //todo : brancher au workflow app
            0L,
            AuditRunStatus.RUNNING,
            LocalDateTime.now(),
            LocalDateTime.now(),
            LocalDateTime.now(),
            "None"
        );
    }
}
