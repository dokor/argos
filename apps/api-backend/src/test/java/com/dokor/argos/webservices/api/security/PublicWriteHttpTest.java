package com.dokor.argos.webservices.api.security;

import com.coreoz.plume.jersey.errors.WsJacksonJsonProvider;
import com.dokor.argos.services.domain.newsletter.NewsletterService;
import com.dokor.argos.webservices.api.newsletter.NewsletterWs;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.ConfigFactory;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.grizzly.threadpool.ThreadPoolConfig;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.net.http.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublicWriteHttpTest {
    @Test void forgedForwardedHeadersCannotBypassLimitAndNewsletterResponsesMatch() throws Exception {
        var newsletter = mock(NewsletterService.class);
        when(newsletter.subscribe(anyString(),any())).thenReturn(NewsletterService.SubscribeResult.SUBSCRIBED, NewsletterService.SubscribeResult.ALREADY_SUBSCRIBED);
        var json = new WsJacksonJsonProvider(); json.setMapper(new ObjectMapper());
        var config = new ResourceConfig().register(json).register(new NewsletterWs(newsletter))
            .register(new PublicWriteFilter(new PublicWriteLimiter(ConfigFactory.empty())));
        var server = GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/"),config,false);
        for(var listener:server.getListeners()) { listener.getTransport().setSelectorRunnersCount(1); listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4)); }
        server.start();
        try {
            var uri = URI.create("http://127.0.0.1:"+server.getListeners().iterator().next().getPort()+"/newsletter/subscribe");
            var client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build(); String previous = null;
            for(int i=0;i<6;i++) {
                var request = HttpRequest.newBuilder(uri).timeout(java.time.Duration.ofSeconds(5)).header("Content-Type","application/json")
                    .header("X-Forwarded-For","203.0.113."+i).header("X-Real-IP","198.51.100."+i)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"synthetic@example.com\"}")).build();
                var response = client.send(request,HttpResponse.BodyHandlers.ofString());
                assertEquals(i<5?200:429,response.statusCode());
                if(i==0) previous=response.body();
                if(i==1) assertEquals(previous,response.body());
                if(i==5) { assertTrue(Integer.parseInt(response.headers().firstValue("Retry-After").orElseThrow())>0); assertFalse(response.body().contains("synthetic@example.com")); }
            }
            verify(newsletter,times(5)).subscribe("synthetic@example.com","127.0.0.1");
        } finally { server.shutdownNow(); }
    }
}
