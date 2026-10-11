package com.dokor.argos.services.account;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** No role/profile claims: current rights are read from the database. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ArgosWebSession(String iss, String aud, String usage, Long uid, Long sid, Long exp) {}
