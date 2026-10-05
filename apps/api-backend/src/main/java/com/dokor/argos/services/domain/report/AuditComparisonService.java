package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.scoring.MeasurementCoverage;
import java.util.*;

/** Compares frozen published evidence. Never invokes the current policy or recalculates history. */
public final class AuditComparisonService {
    public enum Reason { COMPARABLE, NO_PREVIOUS_REPORT, EVIDENCE_MISSING, SCOPE_CHANGED, METHODOLOGY_CHANGED, COVERAGE_CHANGED, INSUFFICIENT_COVERAGE, SCORE_UNAVAILABLE }
    public record DomainDelta(String domain,double points) {}
    public record Contribution(String key,String module,String domain,double domainPoints,double globalPoints) {}
    public record Comparison(Reason reason,Double globalDelta,List<DomainDelta> domains,List<Contribution> contributions,boolean coverageChanged) {}
    private AuditComparisonService() {}
    private static Comparison unavailable(Reason reason,boolean coverageChanged) {return new Comparison(reason,null,List.of(),List.of(),coverageChanged);}
    public static Comparison compare(ReportDto previous,ReportDto current) {
        if(previous==null) return unavailable(Reason.NO_PREVIOUS_REPORT,false);
        if(current==null || previous.scores()==null || current.scores()==null || previous.url()==null || current.url()==null || previous.url().isBlank() || current.url().isBlank()) return unavailable(Reason.EVIDENCE_MISSING,false);
        var old=previous.scores();var now=current.scores();
        var a=old.calculation();var b=now.calculation();var ca=old.coverage();var cb=now.coverage();
        if(a==null || b==null || a.scoringFingerprint()==null || b.scoringFingerprint()==null || a.scoringFingerprint().isBlank() || b.scoringFingerprint().isBlank()
            || a.configuredDomainWeights()==null || b.configuredDomainWeights()==null || a.checks()==null || b.checks()==null || ca==null || cb==null || ca.checks()==null || cb.checks()==null)
            return unavailable(Reason.EVIDENCE_MISSING,false);
        boolean changed=!Objects.equals(ca.version(),cb.version()) || Double.compare(ca.threshold(),cb.threshold())!=0 || !sameCoverage(ca,cb);
        if(!Objects.equals(previous.url(),current.url())) return unavailable(Reason.SCOPE_CHANGED,changed);
        if(a.scoringVersion()!=b.scoringVersion() || !Objects.equals(a.scoringFingerprint(),b.scoringFingerprint()) || !a.configuredDomainWeights().equals(b.configuredDomainWeights())) return unavailable(Reason.METHODOLOGY_CHANGED,changed);
        if(changed) return unavailable(Reason.COVERAGE_CHANGED,true);
        if(ca.provisional() || cb.provisional()) return unavailable(Reason.INSUFFICIENT_COVERAGE,false);
        if(!Boolean.TRUE.equals(old.globalAvailable()) || !Boolean.TRUE.equals(now.globalAvailable())) return unavailable(Reason.SCORE_UNAVAILABLE,false);
        if(a.domains()==null || b.domains()==null || a.domains().size()!=b.domains().size()) return unavailable(Reason.EVIDENCE_MISSING,false);
        var previousDomains=new HashMap<String,ReportDto.DomainCalculation>();a.domains().forEach(d -> previousDomains.put(d.key(),d));
        var deltas=new ArrayList<DomainDelta>();
        for(var domain:b.domains()) {
            var earlier=previousDomains.get(domain.key());
            if(earlier==null || Double.compare(earlier.effectiveWeight(),domain.effectiveWeight())!=0 || Double.compare(earlier.maxScore(),domain.maxScore())!=0) return unavailable(Reason.COVERAGE_CHANGED,true);
            if(domain.maxScore()>0) deltas.add(new DomainDelta(domain.key(),100*(domain.ratio()-earlier.ratio())));
        }
        Map<String,ReportDto.CheckCalculation> oldChecks=new HashMap<>();a.checks().forEach(c -> oldChecks.put(identity(c),c));
        if(oldChecks.size()!=a.checks().size() || oldChecks.size()!=b.checks().size()) return unavailable(Reason.EVIDENCE_MISSING,false);
        var contributions=new ArrayList<Contribution>();
        for(var check:b.checks()) {
            var earlier=oldChecks.remove(identity(check));
            if(earlier==null || Double.compare(earlier.weight(),check.weight())!=0) return unavailable(Reason.COVERAGE_CHANGED,true);
            var domain=b.domains().stream().filter(d -> d.key().equals(check.domain())).findFirst().orElse(null);
            if(domain==null || domain.maxScore()<=0) return unavailable(Reason.EVIDENCE_MISSING,false);
            double points=100*(check.score()-earlier.score())/domain.maxScore();
            if(Math.abs(points)>1e-9) contributions.add(new Contribution(check.key(),check.module(),check.domain(),points,points*domain.effectiveWeight()));
        }
        contributions.sort(Comparator.comparingDouble((Contribution c)->Math.abs(c.globalPoints())).reversed().thenComparing(Contribution::domain).thenComparing(Contribution::key));
        var leading=java.util.stream.Stream.concat(contributions.stream().filter(c -> c.globalPoints()>0).limit(6),
            contributions.stream().filter(c -> c.globalPoints()<0).limit(6)).toList();
        return new Comparison(Reason.COMPARABLE,(double)(now.global()-old.global()),List.copyOf(deltas),leading,false);
    }
    private static String identity(ReportDto.CheckCalculation check) {return check.domain()+":"+check.module()+":"+check.key();}
    private static boolean sameCoverage(MeasurementCoverage a,MeasurementCoverage b) {
        Map<String,MeasurementCoverage.Check> previous=new HashMap<>();a.checks().forEach(c -> previous.put(c.key(),c));
        if(previous.size()!=a.checks().size() || previous.size()!=b.checks().size()) return false;
        for(var check:b.checks()) {
            var earlier=previous.remove(check.key());
            if(earlier==null || !Objects.equals(earlier.domain(),check.domain()) || !Objects.equals(earlier.module(),check.module()) || earlier.state()!=check.state() || Double.compare(earlier.weight(),check.weight())!=0 || !Objects.equals(earlier.reason(),check.reason())) return false;
        }
        return previous.isEmpty();
    }
}
