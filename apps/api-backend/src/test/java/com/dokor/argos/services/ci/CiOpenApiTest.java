package com.dokor.argos.services.ci;

import com.dokor.argos.db.dao.CiRequestDao;
import com.dokor.argos.webservices.api.account.CiIdentityWs;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CiOpenApiTest {
    @Test void documentedPayloadsMatchThePublicRecordsAndReuseTheCanonicalErrors() throws Exception {
        var path=Path.of("../../docs/ci/openapi-v1.json");var mapper=new ObjectMapper();var api=mapper.readTree(path.toFile());
        assertEquals("3.1.0",api.path("openapi").asText());assertEquals("/api/ci/v1",api.path("servers").get(0).path("url").asText());
        var schemas=api.path("components").path("schemas");
        var records=new HashMap<String,Class<?>>(Map.of("Input",CiAdmissionService.Input.class,"Admission",CiAdmissionService.Admission.class,"Run",CiRequestDao.Run.class,
            "Usage",CiAdmissionService.Usage.class,"UsageSnapshot",CiQuotaService.Snapshot.class,"Preflight",CiAdmissionService.Preflight.class,
            "Report",CiAdmissionService.Report.class,"Identity",CiIdentityWs.Identity.class));
        records.putAll(Map.of("Export",CiAdmissionService.Export.class,"ExportDetails",CiExportProjection.class,
            "ExportCategory",CiExportProjection.Category.class,"ExportCheck",CiExportProjection.Check.class,"ExportFinding",CiExportProjection.Finding.class,
            "ArtifactPolicy",CiAdmissionService.ArtifactPolicy.class,"PublicIssue",CiAdmissionService.PublicIssue.class,"Deletion",CiAdmissionService.Deletion.class));
        records.putAll(Map.of("VerdictPolicy",CiVerdictPolicy.Policy.class,"Verdict",CiVerdictEngine.Verdict.class,
            "Fingerprints",CiVerdictEngine.Fingerprints.class,"ConfirmedFinding",CiVerdictEngine.Finding.class));
        records.forEach((name,type)->{
            var actual=Arrays.stream(type.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName).collect(Collectors.toSet());
            var declared=new HashSet<String>();schemas.path(name).path("properties").fieldNames().forEachRemaining(declared::add);
            assertEquals(actual,declared,name);assertFalse(schemas.path(name).path("additionalProperties").asBoolean(true),name);
        });
        for(String name:List.of("ExportCheck","ExportFinding","ConfirmedFinding")) {
            var keys=new HashSet<String>();
            schemas.path(name).path("properties").path("key").path("enum").forEach(key->keys.add(key.asText()));
            assertEquals(CiExportProjection.catalogue().keySet(),keys,name);
        }
        var errors=path.getParent().resolve(schemas.path("Error").path("$ref").asText()).normalize();
        assertTrue(Files.exists(errors));assertEquals("Argos CI error v1 (preview)",mapper.readTree(errors.toFile()).path("title").asText());
        assertEquals(11,api.path("paths").size());
        assertTrue(api.path("paths").path("/analyses").path("post").path("parameters").get(0).path("required").asBoolean());
        assertEquals("bearer",api.path("components").path("securitySchemes").path("argosCiApiKey").path("scheme").asText());
    }
}
