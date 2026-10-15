package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.*;

@Singleton
public class ReportSharingService {
    public record Link(String token, String expiresAt) {}
    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final ReportReadService reports;
    private final TokenService tokens;
    private final Clock clock;
    @Inject public ReportSharingService(AccountDao dao, AccountSessionService sessions, ReportReadService reports, TokenService tokens, Clock clock) {
        this.dao=dao;this.sessions=sessions;this.reports=reports;this.tokens=tokens;this.clock=clock;
    }
    public Link create(String auth, String csrf, long run, int days) {
        if (days!=7 && days!=30 && days!=0) throw AccountError.forbidden("payload_invalid");
        return sessions.with(auth,csrf,true,true,(ctx,c)->{
            owned(c,run,ctx.user().getId());
            reports.getByRunId(run).orElseThrow(AccountError::missing);
            String token=tokens.generateToken(); var expiry=days==0?null:clock.instant().plus(Duration.ofDays(days));
            try(var statement=c.prepareStatement("UPDATE ARG_AUDIT_REPORT SET share_token_hash=?,share_expires_at=? WHERE run_id=?")) {
                statement.setBytes(1,tokens.sha256(token));statement.setTimestamp(2,expiry==null?null:Timestamp.from(expiry));statement.setLong(3,run);
                if(statement.executeUpdate()!=1)throw AccountError.missing();
                return new Link(token,expiry==null?null:expiry.toString());
            }catch(SQLException e){throw new IllegalStateException("Share update failed",e);}
        });
    }
    public void revoke(String auth,String csrf,long run) {
        sessions.with(auth,csrf,true,true,(ctx,c)->{owned(c,run,ctx.user().getId());
            try(var statement=c.prepareStatement("UPDATE ARG_AUDIT_REPORT SET share_token_hash=NULL,share_expires_at=NULL WHERE run_id=?")) {
                statement.setLong(1,run);statement.executeUpdate();return null;
            }catch(SQLException e){throw new IllegalStateException("Share revocation failed",e);}
        });
    }
    private static void owned(Connection c,long run,long user) {
        try(var s=c.prepareStatement("SELECT id FROM ARG_AUDIT_RUN WHERE id=? AND owner_user_id=? FOR UPDATE")) {
            s.setLong(1,run);s.setLong(2,user);try(var r=s.executeQuery()){if(!r.next())throw AccountError.missing();}
        }catch(SQLException e){throw new IllegalStateException("Share ownership unavailable",e);}
    }
    public Optional<ReportDto> shared(String token) {
        if(token==null||!token.matches("[A-Za-z0-9_-]{43}"))return Optional.empty();
        Long run=dao.transaction(c->{
            try(var s=c.prepareStatement("SELECT run_id FROM ARG_AUDIT_REPORT WHERE share_token_hash=? AND (share_expires_at IS NULL OR share_expires_at>?)")) {
                s.setBytes(1,tokens.sha256(token));s.setTimestamp(2,Timestamp.from(clock.instant()));
                try(var r=s.executeQuery()){return r.next()?r.getLong(1):null;}
            }catch(SQLException e){throw new IllegalStateException("Shared report unavailable",e);}
        });
        return run==null?Optional.empty():reports.getByRunId(run);
    }
    public ReportDto details(String auth,String token,boolean shared) {
        sessions.with(auth,null,true,true,(ctx,c)->null);
        return (shared?shared(token):reports.getByToken(token)).orElseThrow(AccountError::missing);
    }
}
