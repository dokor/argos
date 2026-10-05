package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.NewsletterDao;
import com.dokor.argos.services.domain.newsletter.NewsletterService;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.junit.jupiter.api.Test;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class NewsletterPrivacyIT extends MariaDbReportFixture {
    @Test void concurrentNewAndDuplicateSubscriptionsFollowSameSqlPathAndKeepOneRow() throws Exception {
        var service = new NewsletterService(new NewsletterDao(new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT))));
        try(var pool=Executors.newFixedThreadPool(8)) {
            var start=new CyclicBarrier(8); var futures=new java.util.ArrayList<Future<NewsletterService.SubscribeResult>>();
            for(int i=0;i<8;i++) futures.add(pool.submit(() -> {start.await();return service.subscribe("Synthetic@Example.com",null);}));
            for(var future:futures) assertEquals(NewsletterService.SubscribeResult.SUBSCRIBED,future.get(10,TimeUnit.SECONDS));
        }
        try(var connection=source.getConnection();var statement=connection.createStatement();var rows=statement.executeQuery("SELECT COUNT(*) FROM ARG_NEWSLETTER_SUBSCRIBER WHERE email='synthetic@example.com'")) {assertTrue(rows.next());assertEquals(1,rows.getInt(1));}
    }
}
