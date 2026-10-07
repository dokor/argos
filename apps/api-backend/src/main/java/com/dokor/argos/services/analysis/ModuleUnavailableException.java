package com.dokor.argos.services.analysis;

/** A module cannot provide usable measurements, without implying a defect in the audited site. */
public class ModuleUnavailableException extends RuntimeException {
    public ModuleUnavailableException(String message) {
        super(message);
    }

    public ModuleUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
