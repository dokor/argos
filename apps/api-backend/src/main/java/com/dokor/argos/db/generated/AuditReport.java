package com.dokor.argos.db.generated;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import javax.annotation.processing.Generated;
import com.querydsl.sql.Column;

/**
 * AuditReport is a Querydsl bean type
 */
@Generated("com.coreoz.plume.db.querydsl.generation.IdBeanSerializer")
public class AuditReport extends com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl {

    @Column("audit_id")
    @JsonSerialize(using=com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long auditId;

    @Column("created_at")
    private java.time.Instant createdAt;

    @Column("domain")
    private String domain;

    @Column("expires_at")
    private java.time.Instant expiresAt;

    @Column("id")
    @JsonSerialize(using=com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long id;

    @Column("logo_url")
    private String logoUrl;

    @Column("public_token")
    private String publicToken;

    @Column("report_json")
    private String reportJson;

    @Column("run_id")
    @JsonSerialize(using=com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long runId;

    @Column("site_title")
    private String siteTitle;

    @Column("target_url")
    private String targetUrl;

    @Column("token_hash")
    private byte[] tokenHash;

    public Long getAuditId() {
        return auditId;
    }

    public void setAuditId(Long auditId) {
        this.auditId = auditId;
    }

    public java.time.Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(java.time.Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public java.time.Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(java.time.Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public String getPublicToken() {
        return publicToken;
    }

    public void setPublicToken(String publicToken) {
        this.publicToken = publicToken;
    }

    public String getReportJson() {
        return reportJson;
    }

    public void setReportJson(String reportJson) {
        this.reportJson = reportJson;
    }

    public Long getRunId() {
        return runId;
    }

    public void setRunId(Long runId) {
        this.runId = runId;
    }

    public String getSiteTitle() {
        return siteTitle;
    }

    public void setSiteTitle(String siteTitle) {
        this.siteTitle = siteTitle;
    }

    public String getTargetUrl() {
        return targetUrl;
    }

    public void setTargetUrl(String targetUrl) {
        this.targetUrl = targetUrl;
    }

    public byte[] getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(byte[] tokenHash) {
        this.tokenHash = tokenHash;
    }

    @Override
    public String toString() {
        return "AuditReport#" + id;
    }

    @Override
    public boolean equals(Object o) {
        if (id == null) {
            return super.equals(o);
        }
        if (!(o instanceof AuditReport)) {
            return false;
        }
        AuditReport obj = (AuditReport) o;
        return id.equals(obj.id);
    }

    @Override
    public int hashCode() {
        if (id == null) {
            return super.hashCode();
        }
        final int prime = 31;
        int result = 1;
        result = prime * result + id.hashCode();
        return result;
    }

}

