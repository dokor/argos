package com.dokor.argos.services.analysis;

import org.glassfish.jersey.spi.Contract;

@Contract
public interface UrlAuditAnalyzer {
    UrlAuditResult analyze(String url);
}
