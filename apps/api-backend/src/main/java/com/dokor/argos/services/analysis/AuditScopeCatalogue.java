package com.dokor.argos.services.analysis;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.scoring.*;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.util.*;

/** Canonical rules select result checks; their source engines determine execution. */
@Singleton
public class AuditScopeCatalogue {
    private final ScorePolicy policy;
    @Inject public AuditScopeCatalogue(ScorePolicy policy) { this.policy = policy; }

    public AuditScope validate(AuditScope requested) {
        AuditScope scope = requested == null ? AuditScope.full() : requested;
        if ("category".equals(scope.kind()) && !Set.of("performance", "security", "seo", "a11y").contains(scope.target()))
            throw new IllegalArgumentException("Unknown analysis category");
        if ("check".equals(scope.kind()) && (!supportedCheck(scope.target())))
            throw new IllegalArgumentException("Unknown or non-executable analysis check");
        return scope;
    }

    private boolean supportedCheck(String key) {
        return !key.endsWith(".collect") && (policy.cataloguedKeys().contains(key)
            || key.matches("lighthouse\\.audit\\.[a-z0-9-]{1,120}")
            || key.matches("zap\\.alert\\.[a-zA-Z0-9_.-]{1,120}"));
    }
    public List<String> executableCheckKeys() {
        return policy.cataloguedKeys().stream().filter(this::supportedCheck).sorted().toList();
    }

    public Set<AuditModule> modules(AuditScope requested) {
        AuditScope scope = validate(requested);
        if (!scope.partial()) return EnumSet.allOf(AuditModule.class);
        Set<AuditModule> modules = EnumSet.of(AuditModule.HTTP); // final response context
        if ("check".equals(scope.kind())) {
            modules.add(owner(scope.target()));
        } else {
            policy.cataloguedKeys().stream().filter(key -> scope.target().equals(policy.ruleFor(null, key).businessCategory().tag()))
                .map(this::owner).forEach(modules::add);
            // Detailed diagnostics share the engine with its scored category.
            modules.add(AuditModule.LIGHTHOUSE);
            if ("security".equals(scope.target())) modules.add(AuditModule.ZAP);
        }
        return Collections.unmodifiableSet(modules);
    }

    private AuditModule owner(String key) {
        String source = policy.ruleFor(null, key).technicalSource().tag();
        return AuditModule.ordered().stream().filter(m -> m.id().equals(source)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Check has no executable source"));
    }

    public List<AuditModuleResult> select(AuditScope scope, List<AuditModuleResult> modules) {
        if (!scope.partial()) return modules;
        return modules.stream().map(module -> new AuditModuleResult(module.id(), module.title(), module.summary(), module.data(),
            module.checks().stream().filter(check -> check.key().endsWith(".collect") ||
                ("check".equals(scope.kind()) ? scope.target().equals(check.key()) :
                    policy.businessCategoryFor(module.id(), check.key(), check.tags()).filter(scope.target()::equals).isPresent()))
                .toList())).toList();
    }
}
