package com.dokor.argos.services.ci;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.*;
import java.sql.Timestamp;
import java.time.Clock;
/** Persistent invalid-auth budget shared by instances. Forwarded headers never choose the peer. */
@Singleton
public class CiAuthLimiter {
    private final AccountDao dao; private final TokenService tokens; private final Clock clock;
    @Inject public CiAuthLimiter(AccountDao dao,TokenService tokens,Clock clock){this.dao=dao;this.tokens=tokens;this.clock=clock;}
    private byte[] bucket(String peer){return tokens.sha256("ci-invalid-auth:"+clock.instant().getEpochSecond()/900+":"+peer);}
    public boolean blocked(String peer) {
        return dao.transaction(c->{try(var s=c.prepareStatement("SELECT attempts FROM ARG_ACCOUNT_RATE WHERE bucket_hash=?")){
            s.setBytes(1,bucket(peer));try(var r=s.executeQuery()){return r.next() && r.getInt(1)>=60;}
        }catch(Exception failed){throw new IllegalStateException("CI authentication budget unavailable");}});
    }
    /** Called after the rejected auth transaction ended, so rejection cannot roll this back. */
    public void failed(String peer) {
        // Cleanup and insertion must not share a transaction: concurrent gap locks can deadlock.
        dao.transaction(c->{try {
            try(var cleanup=c.prepareStatement("DELETE FROM ARG_ACCOUNT_RATE WHERE expires_at<? LIMIT 1000")){
                cleanup.setTimestamp(1,Timestamp.from(clock.instant()));cleanup.executeUpdate();}
            return null;
        }catch(Exception failed){throw new IllegalStateException("CI authentication budget unavailable");}});
        dao.transaction(c->{try {
            try(var s=c.prepareStatement("INSERT INTO ARG_ACCOUNT_RATE(bucket_hash,attempts,expires_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=LEAST(attempts+1,1000000)")){
                s.setBytes(1,bucket(peer));s.setTimestamp(2,Timestamp.from(java.time.Instant.ofEpochSecond((clock.instant().getEpochSecond()/900+1)*900)));s.executeUpdate();}
            return null;
        }catch(Exception failed){throw new IllegalStateException("CI authentication budget unavailable");}});
    }
}
