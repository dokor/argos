package com.dokor.argos.webservices.api.audits.data;

import java.time.Instant;

/** Public progress credential is supplied in the request and never echoed. */
public record ReportStatusResponse(String status, Instant createdAt, Instant startedAt,
                                   Instant finishedAt, String moduleStatuses) {}
