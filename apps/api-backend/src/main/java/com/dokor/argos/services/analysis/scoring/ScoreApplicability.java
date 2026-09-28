package com.dokor.argos.services.analysis.scoring;

/** Indique si une règle compte dans la note ou reste visible à titre de diagnostic. */
public enum ScoreApplicability {
    SCORE,
    VISIBLE_DIAGNOSTIC,
    INFORMATIONAL;

    public boolean contributesToScore() {
        return this == SCORE;
    }

    public boolean isVisibleIssue() {
        return this != INFORMATIONAL;
    }
}
