package com.dokor.argos.db.generated;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import javax.annotation.processing.Generated;
import com.querydsl.sql.Column;

/**
 * NewsletterSubscriber is a Querydsl bean type
 */
@Generated("com.coreoz.plume.db.querydsl.generation.IdBeanSerializer")
public class NewsletterSubscriber extends com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl {

    @Column("created_at")
    private java.time.Instant createdAt;

    @Column("email")
    private String email;

    @Column("id")
    @JsonSerialize(using = com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private Long id;

    @Column("ip_hint")
    private String ipHint;

    public java.time.Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(java.time.Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getIpHint() {
        return ipHint;
    }

    public void setIpHint(String ipHint) {
        this.ipHint = ipHint;
    }

    @Override
    public String toString() {
        return "NewsletterSubscriber#" + id;
    }

    @Override
    public boolean equals(Object o) {
        if (id == null) {
            return super.equals(o);
        }
        if (!(o instanceof NewsletterSubscriber)) {
            return false;
        }
        NewsletterSubscriber obj = (NewsletterSubscriber) o;
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
