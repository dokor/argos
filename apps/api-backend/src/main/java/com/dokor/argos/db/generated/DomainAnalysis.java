package com.dokor.argos.db.generated;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import javax.annotation.processing.Generated;
import com.querydsl.sql.Column;

/**
 * DomainAnalysis is a Querydsl bean type.
 * <p>
 * Stocke le résultat du module d'analyse "tech" pour un domaine donné,
 * avec une date d'expiration pour la mise en cache (TTL).
 */
@Generated("com.coreoz.plume.db.querydsl.generation.IdBeanSerializer")
public class DomainAnalysis extends com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl {

    @Column("analyzed_at")
    private java.time.Instant analyzedAt;

    @Column("domain_id")
    @JsonSerialize(using = com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long domainId;

    @Column("expires_at")
    private java.time.Instant expiresAt;

    @Column("id")
    @JsonSerialize(using = com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long id;

    @Column("result_json")
    private String resultJson;

    public java.time.Instant getAnalyzedAt() {
        return analyzedAt;
    }

    public void setAnalyzedAt(java.time.Instant analyzedAt) {
        this.analyzedAt = analyzedAt;
    }

    public Long getDomainId() {
        return domainId;
    }

    public void setDomainId(Long domainId) {
        this.domainId = domainId;
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

    public String getResultJson() {
        return resultJson;
    }

    public void setResultJson(String resultJson) {
        this.resultJson = resultJson;
    }

    @Override
    public String toString() {
        return "DomainAnalysis#" + id + "(domainId=" + domainId + ")";
    }

    @Override
    public boolean equals(Object o) {
        if (id == null) return super.equals(o);
        if (!(o instanceof DomainAnalysis)) return false;
        return id.equals(((DomainAnalysis) o).id);
    }

    @Override
    public int hashCode() {
        if (id == null) return super.hashCode();
        return 31 + id.hashCode();
    }
}
