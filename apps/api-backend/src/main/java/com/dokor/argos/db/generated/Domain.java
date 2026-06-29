package com.dokor.argos.db.generated;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import javax.annotation.processing.Generated;
import com.querydsl.sql.Column;

/**
 * Domain is a Querydsl bean type — représente un domaine (hostname) unique.
 */
@Generated("com.coreoz.plume.db.querydsl.generation.IdBeanSerializer")
public class Domain extends com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl {

    @Column("created_at")
    private java.time.Instant createdAt;

    @Column("hostname")
    private String hostname;

    @Column("id")
    @JsonSerialize(using = com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long id;

    public java.time.Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(java.time.Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getHostname() {
        return hostname;
    }

    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    @Override
    public String toString() {
        return "Domain#" + id + "(" + hostname + ")";
    }

    @Override
    public boolean equals(Object o) {
        if (id == null) return super.equals(o);
        if (!(o instanceof Domain)) return false;
        return id.equals(((Domain) o).id);
    }

    @Override
    public int hashCode() {
        if (id == null) return super.hashCode();
        return 31 + id.hashCode();
    }
}
