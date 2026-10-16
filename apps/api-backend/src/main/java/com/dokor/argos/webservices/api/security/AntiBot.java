package com.dokor.argos.webservices.api.security;
import java.lang.annotation.*;
@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.METHOD)
public @interface AntiBot { String value(); }
