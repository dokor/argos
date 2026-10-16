package com.dokor.argos.services.notifications;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.services.account.AccountError;
import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.*;

@Singleton
public class NotificationService {
    public record Item(String id, String type, String hostname, Integer count, Instant createdAt, Instant readAt, String href) {}
    public record Inbox(List<Item> items, long unread, String cursor, Instant serverTime) {}
    private final TransactionManagerQuerydsl transactions;
    private final Clock clock;
    @Inject public NotificationService(TransactionManagerQuerydsl transactions, Clock clock) { this.transactions=transactions; this.clock=clock; }
    private static Calendar utc(){return Calendar.getInstance(TimeZone.getTimeZone("UTC"));}
    public Inbox list(long owner, Connection c) {
        var items=new ArrayList<Item>(); long unread; String cursor="0";
        try(var q=c.prepareStatement("SELECT id,type,entity_id,site_id,hostname,item_count,created_at,read_at FROM ARG_ACCOUNT_NOTIFICATION WHERE owner_user_id=? ORDER BY id DESC LIMIT 30")) {
            q.setLong(1,owner);
            try(var r=q.executeQuery()){while(r.next()){
                String type=r.getString(2), entity=r.getString(3), site=r.getString(4);
                String href=type.startsWith("ANALYSIS_") ? "/account/runs/"+entity : type.startsWith("DISCOVERY_") ? "/account/domains/new?discovery="+entity : "/account/domains/"+site+"/batches/"+entity;
                var read=r.getTimestamp(8,utc());
                items.add(new Item(r.getString(1),type,r.getString(5),(Integer)r.getObject(6),r.getTimestamp(7,utc()).toInstant(),read==null?null:read.toInstant(),href));
            }}
            if(!items.isEmpty())cursor=items.getFirst().id();
        }catch(SQLException e){throw new IllegalStateException("Notification read unavailable");}
        try(var q=c.prepareStatement("SELECT COUNT(*) FROM ARG_ACCOUNT_NOTIFICATION WHERE owner_user_id=? AND read_at IS NULL")) {
            q.setLong(1,owner);try(var r=q.executeQuery()){r.next();unread=r.getLong(1);}
        }catch(SQLException e){throw new IllegalStateException("Notification count unavailable");}
        return new Inbox(List.copyOf(items),unread,cursor,clock.instant());
    }
    /** Through a displayed cursor: a new concurrent event must remain unread. */
    public void read(long owner, long id, boolean all, Connection c) {
        if(id<1)throw new AccountError(400,"payload_invalid");
        try(var q=c.prepareStatement("UPDATE ARG_ACCOUNT_NOTIFICATION SET read_at=COALESCE(read_at,?) WHERE owner_user_id=? AND id"+(all?"<=?":"=?"))) {
            q.setTimestamp(1,Timestamp.from(clock.instant()),utc());q.setLong(2,owner);q.setLong(3,id);
            if(q.executeUpdate()==0 && !all) {
                try(var exists=c.prepareStatement("SELECT id FROM ARG_ACCOUNT_NOTIFICATION WHERE owner_user_id=? AND id=?")){
                    exists.setLong(1,owner);exists.setLong(2,id);try(var r=exists.executeQuery()){if(!r.next())throw new AccountError(404,"resource_unavailable");}
                }
            }
        }catch(SQLException e){throw new IllegalStateException("Notification update unavailable");}
    }
    public void purge(){transactions.executeAndReturn(c->{try(var q=c.prepareStatement("DELETE FROM ARG_ACCOUNT_NOTIFICATION WHERE created_at<?")){
        q.setTimestamp(1,Timestamp.from(clock.instant().minus(Duration.ofDays(90))),utc());return q.executeUpdate();
    }catch(SQLException e){throw new IllegalStateException("Notification retention unavailable");}});}
}
