package com.dokor.argos.webservices.api.account;

import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface AccountAccess {
    String value() default "session";
}
