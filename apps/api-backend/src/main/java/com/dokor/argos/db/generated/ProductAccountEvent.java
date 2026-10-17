package com.dokor.argos.db.generated;

/** Internal deduplication references, manually maintained for V36. */
public class ProductAccountEvent {
    private String eventName;
    public String getEventName() { return eventName; }
    public void setEventName(String value) { this.eventName = value; }
    private Long subjectId;
    public Long getSubjectId() { return subjectId; }
    public void setSubjectId(Long value) { this.subjectId = value; }
    private String eventKey;
    public String getEventKey() { return eventKey; }
    public void setEventKey(String value) { this.eventKey = value; }
    private Long userId;
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { this.userId = value; }
    private java.time.Instant occurredAt;
    public java.time.Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(java.time.Instant value) { this.occurredAt = value; }
    private String locale;
    public String getLocale() { return locale; }
    public void setLocale(String value) { this.locale = value; }
    private String method;
    public String getMethod() { return method; }
    public void setMethod(String value) { this.method = value; }
}
