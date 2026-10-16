package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import java.time.Instant;

/** Mapping maintained with V35__premium_waitlist.sql. */
public class PremiumWaitlistEntry extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("email") private String email;
    @Column("locale") private String locale;
    @Column("consent_version") private String consentVersion;
    @Column("created_at") private Instant createdAt;
    @Column("expires_at") private Instant expiresAt;
    public Long getId() { return id; }
    public void setId(Long value) { id = value; }
    public String getEmail() { return email; }
    public void setEmail(String value) { email = value; }
    public String getLocale() { return locale; }
    public void setLocale(String value) { locale = value; }
    public String getConsentVersion() { return consentVersion; }
    public void setConsentVersion(String value) { consentVersion = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant value) { createdAt = value; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant value) { expiresAt = value; }
    @Override public String toString() { return "PremiumWaitlistEntry#" + id; }
}
