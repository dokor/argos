package com.dokor.argos.db.generated;

import com.querydsl.sql.Column;
import javax.annotation.processing.Generated;

@Generated("com.coreoz.plume.db.querydsl.generation.BeanSerializer")
@lombok.Data
public class ReportProblemCheck {
    @Column("report_id") private Long reportId;
    @Column("check_key") private String checkKey;
    @Column("category") private String category;
    @Column("severity") private String severity;
}
