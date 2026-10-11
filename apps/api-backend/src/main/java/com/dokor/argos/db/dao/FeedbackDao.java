package com.dokor.argos.db.dao;

import com.dokor.argos.db.generated.*;
import jakarta.inject.*;
import java.sql.Connection;
import java.time.Instant;
import java.util.List;

@Singleton
public class FeedbackDao {
 private final AccountDao dao;
 @Inject public FeedbackDao(AccountDao dao) {this.dao=dao;}
 public Feedback save(Feedback value,Connection c) {return dao.save(value,QFeedback.table,c);}
 public void event(FeedbackEvent value,Connection c) {dao.save(value,QFeedbackEvent.table,c);}
 public Feedback get(long id,Instant cutoff,Connection c,boolean lock) {
  var t=QFeedback.table;
  var query=dao.transactions.selectQuery(c).select(t).from(t).where(t.id.eq(id),t.createdAt.goe(cutoff));
  return (lock?query.forUpdate():query).fetchOne();
 }
 public List<Feedback> list(String type,String status,int limit,Long cursor,Instant cutoff,Connection c) {
  var t=QFeedback.table;
  var query=dao.transactions.selectQuery(c).select(t).from(t).where(t.createdAt.goe(cutoff));
  if(type!=null) query.where(t.type.eq(type));
  if(status!=null) query.where(t.status.eq(status));
  if(cursor!=null) query.where(t.id.lt(cursor));
  return query.orderBy(t.id.desc()).limit(limit+1).fetch();
 }
 public List<FeedbackEvent> events(long id,Connection c) {
  var t=QFeedbackEvent.table;
  return dao.transactions.selectQuery(c).select(t).from(t).where(t.feedbackId.eq(id)).orderBy(t.id.asc()).fetch();
 }
 public long purge(Instant cutoff,Connection c) {
  var t=QFeedback.table;
  return dao.transactions.delete(t,c).where(t.createdAt.lt(cutoff)).execute();
 }
}
