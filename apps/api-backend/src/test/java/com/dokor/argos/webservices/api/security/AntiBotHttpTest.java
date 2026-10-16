package com.dokor.argos.webservices.api.security;
import com.coreoz.plume.jersey.errors.WsJacksonJsonProvider;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.security.AntiBotService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.grizzly.threadpool.ThreadPoolConfig;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.net.http.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class AntiBotHttpTest {
 @Path("/audits") public static class Probe {
  static final AtomicInteger mutations=new AtomicInteger();
  @POST @AntiBot("audit") public Response create() {mutations.incrementAndGet();return Response.ok("{}").build();}
 }
 @Test void directHttpAndMatrixParameterVariantsCannotReachMutationWithoutProof() throws Exception {
  Probe.mutations.set(0);var service=mock(AntiBotService.class);when(service.enabled()).thenReturn(true);
  doAnswer(call->{throw new AccountError(400,"antibot_invalid");}).when(service).require(isNull(),eq("audit"));
  var json=new WsJacksonJsonProvider();json.setMapper(new ObjectMapper());
  var config=new ResourceConfig().register(Probe.class).register(json).register(new AntiBotFilter(service,mock(AccountSessionService.class)));
  var server=GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/"),config,false);
  for(var listener:server.getListeners()){listener.getTransport().setSelectorRunnersCount(1);listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4));}
  server.start();
  try {
   String base="http://127.0.0.1:"+server.getListeners().iterator().next().getPort();var client=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
   for(String path:new String[]{"/audits","/audits/","/audits;variant=x","/%61udits"}){
    var response=client.send(HttpRequest.newBuilder(URI.create(base+path)).header("X-Argos-Captcha-Verified","true").POST(HttpRequest.BodyPublishers.ofString("{}")).build(),HttpResponse.BodyHandlers.ofString());
    assertEquals(path.equals("/%61udits")?404:400,response.statusCode(),path+" "+response.body());
   }
   assertEquals(0,Probe.mutations.get());
   var accepted=client.send(HttpRequest.newBuilder(URI.create(base+"/audits")).header(AntiBotService.HEADER,"valid-proof").POST(HttpRequest.BodyPublishers.ofString("{}")).build(),HttpResponse.BodyHandlers.ofString());
   assertEquals(200,accepted.statusCode());assertEquals(1,Probe.mutations.get());verify(service).require("valid-proof","audit");
  } finally {server.shutdownNow();}
 }
}
