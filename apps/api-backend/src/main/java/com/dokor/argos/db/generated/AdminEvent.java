package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminEvent extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("actor_id")
    private Long actorId;

    @Column("target_id")
    private Long targetId;

    @Column("old_offer")
    private String oldOffer;

    @Column("new_offer")
    private String newOffer;

    @Column("old_limit")
    private Long oldLimit;

    @Column("new_limit")
    private Long newLimit;

    @Column("created_at")
    private java.time.Instant createdAt;

    @Column("old_state")
    private String oldState;

    @Column("new_state")
    private String newState;

    @Column("reason_code")
    private String reasonCode;

    @Column("request_id")
    private String requestId;

    @Override
    public String toString() {
        return "AdminEvent#" + id;
    }
}
