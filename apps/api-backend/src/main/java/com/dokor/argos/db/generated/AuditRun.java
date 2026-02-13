package com.dokor.argos.db.generated;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import javax.annotation.processing.Generated;
import com.querydsl.sql.Column;

/**
 * AuditRun is a Querydsl bean type
 */
@Generated("com.coreoz.plume.db.querydsl.generation.IdBeanSerializer")
public class AuditRun extends com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl {

    @Column("audit_id")
    @JsonSerialize(using=com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long auditId;

    @Column("claim_token")
    private String claimToken;

    @Column("created_at")
    private java.time.Instant createdAt;

    @Column("finished_at")
    private java.time.Instant finishedAt;

    @Column("id")
    @JsonSerialize(using=com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long id;

    @Column("last_error")
    private String lastError;

    @Column("result_json")
    private String resultJson;

    @Column("started_at")
    private java.time.Instant startedAt;

    @Column("status")
    private String status;

    public Long getAuditId() {
        return auditId;
    }

    public void setAuditId(Long auditId) {
        this.auditId = auditId;
    }

    public String getClaimToken() {
        return claimToken;
    }

    public void setClaimToken(String claimToken) {
        this.claimToken = claimToken;
    }

    public java.time.Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(java.time.Instant createdAt) {
        this.createdAt = createdAt;
    }

    public java.time.Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(java.time.Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public String getResultJson() {
        return resultJson;
    }

    public void setResultJson(String resultJson) {
        this.resultJson = resultJson;
    }

    public java.time.Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(java.time.Instant startedAt) {
        this.startedAt = startedAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @Override
    public String toString() {
        return "AuditRun#" + id;
    }

    @Override
    public boolean equals(Object o) {
        if (id == null) {
            return super.equals(o);
        }
        if (!(o instanceof AuditRun)) {
            return false;
        }
        AuditRun obj = (AuditRun) o;
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

