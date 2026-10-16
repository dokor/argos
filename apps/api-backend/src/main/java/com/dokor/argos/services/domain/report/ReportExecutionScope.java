package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.AuditScope;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** Method and provenance accompany the score, including in a public summary. */
public record ReportExecutionScope(String kind, String target, List<String> executedModules,
                                   List<String> newCheckKeys, List<String> reusedCheckKeys) {
    public static ReportExecutionScope from(Map<String,String> meta) {
        if(meta==null || meta.get("executionScope")==null) return null;
        try {
            var mapper = new ObjectMapper();
            var scope = mapper.readValue(meta.get("executionScope"),AuditScope.class);
            return new ReportExecutionScope(scope.kind(),scope.target(),read(mapper,meta.get("executedModules")),
                read(mapper,meta.get("newCheckKeys")),read(mapper,meta.get("reusedCheckKeys")));
        } catch(java.io.IOException invalid) { throw new IllegalArgumentException("Invalid report scope",invalid); }
    }
    private static List<String> read(ObjectMapper mapper,String json) throws java.io.IOException {
        return json==null ? List.of() : mapper.readValue(json,new TypeReference<List<String>>(){});
    }
}
