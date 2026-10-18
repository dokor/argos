package com.dokor.argos.services.ci;

import com.dokor.argos.services.analysis.AuditEgress;
import com.dokor.argos.services.token.TokenService;
import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.KeyStore;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import javax.net.ssl.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class CiProofTransportTest {
    @TempDir Path root;
    @Test void realTlsProofUsesOnlyTheConfiguredTunnelPreservesHostnameVerificationAndNeverFollowsRedirects() throws Exception {
        var tokens=new TokenService();String password=tokens.generateToken(),proof="argos-ci-v1="+tokens.generateToken();
        var store=root.resolve("fixture.p12");
        String executable=System.getProperty("os.name").startsWith("Windows")?"keytool.exe":"keytool";
        var tool=new ProcessBuilder(Path.of(System.getProperty("java.home"),"bin",executable).toString(),
            "-genkeypair","-alias","fixture","-keyalg","RSA","-keysize","2048","-validity","2","-dname","CN=ci.example.com",
            "-ext","SAN=DNS:ci.example.com","-storetype","PKCS12","-keystore",store.toString(),"-storepass",password,"-noprompt")
            .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
        assertTrue(tool.waitFor(20,TimeUnit.SECONDS));assertEquals(0,tool.exitValue());
        var ks=KeyStore.getInstance("PKCS12");try(var in=Files.newInputStream(store)){ks.load(in,password.toCharArray());}
        var km=KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());km.init(ks,password.toCharArray());
        var tm=TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());tm.init(ks);
        var tls=SSLContext.getInstance("TLS");tls.init(km.getKeyManagers(),tm.getTrustManagers(),null);
        var server=HttpsServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(),0),0);
        server.setHttpsConfigurator(new HttpsConfigurator(tls));
        var calls=new AtomicInteger();var status=new AtomicInteger(200);
        var headers=new CopyOnWriteArrayList<String>();
        String id="49e4eac3-00a9-4de4-81dc-f4686fb677cc";
        server.createContext(HttpsTargetProofClient.path(id),exchange->{
            calls.incrementAndGet();headers.add(String.join(",",exchange.getRequestHeaders().keySet()));
            byte[] bytes=proof.getBytes(StandardCharsets.UTF_8);
            if(status.get()!=200)exchange.getResponseHeaders().set("Location","https://127.0.0.1/secret");
            exchange.sendResponseHeaders(status.get(),bytes.length);
            try(var out=exchange.getResponseBody()){out.write(bytes);}finally{exchange.close();}
        });
        server.start();
        try(var tunnel=new Tunnel(server.getAddress().getPort())) {
            var proxy=new AuditEgress("http://127.0.0.1:"+tunnel.port());
            try(var http=HttpsTargetProofClient.transport(proxy,tls)) {
                var client=new HttpsTargetProofClient(http,tokens);
                assertTrue(client.matches("https://ci.example.com",id,tokens.sha256(proof)));
                assertEquals(1,calls.get());status.set(302);
                assertFalse(client.matches("https://ci.example.com",id,tokens.sha256(proof)));assertEquals(2,calls.get());
                for(String rejected:List.of("https://168.63.129.16","https://169.254.169.254","https://[fd00:ec2::254]"))
                    assertFalse(client.matches(rejected,id,tokens.sha256(proof)));
            }
            try(var untrusted=HttpsTargetProofClient.transport(proxy,null)) {
                assertFalse(new HttpsTargetProofClient(untrusted,tokens).matches("https://ci.example.com",id,tokens.sha256(proof)));
                assertEquals(2,calls.get(),"An untrusted certificate must not reach HTTP");
            }
            assertFalse(tunnel.requests.isEmpty());
            assertTrue(tunnel.requests.stream().allMatch(value->value.startsWith("CONNECT ci.example.com:443 HTTP/1.1\r\n")));
            assertTrue(headers.stream().noneMatch(value->value.toLowerCase(Locale.ROOT).matches("(?s).*(authorization|cookie).*")));
        }finally{server.stop(0);}
    }
    /** Fixture maps only one reserved example.com host to localhost; no external connection exists. */
    private static final class Tunnel implements AutoCloseable {
        private final ServerSocket listener=new ServerSocket(0,50,InetAddress.getLoopbackAddress());
        private final ExecutorService threads=Executors.newVirtualThreadPerTaskExecutor();
        private final Set<Socket> sockets=ConcurrentHashMap.newKeySet();
        final List<String> requests=new CopyOnWriteArrayList<>();
        Tunnel(int target) throws IOException {
            threads.submit(()->{while(!listener.isClosed())try {
                Socket client=listener.accept();sockets.add(client);threads.submit(()->serve(client,target));
            }catch(IOException stopped){break;}});
        }
        int port(){return listener.getLocalPort();}
        void serve(Socket client,int target) {
            try(client) {
                client.setSoTimeout(10000);
                var raw=new ByteArrayOutputStream();var input=client.getInputStream();
                while(raw.size()<16384) {int b=input.read();if(b<0)throw new EOFException();raw.write(b);
                    if(raw.toString(StandardCharsets.ISO_8859_1).endsWith("\r\n\r\n"))break;}
                String request=raw.toString(StandardCharsets.ISO_8859_1);requests.add(request);
                if(!request.startsWith("CONNECT ci.example.com:443 HTTP/1.1\r\n"))return;
                try(var upstream=new Socket(InetAddress.getLoopbackAddress(),target)) {
                    sockets.add(upstream);client.getOutputStream().write("HTTP/1.1 200 Connection Established\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
                    threads.submit(()->{try{input.transferTo(upstream.getOutputStream());}catch(IOException closed){}finally{try{upstream.shutdownOutput();}catch(IOException closed){}}});
                    upstream.getInputStream().transferTo(client.getOutputStream());sockets.remove(upstream);
                }
            }catch(IOException closed){}finally{sockets.remove(client);}
        }
        public void close() throws IOException {
            listener.close();for(var socket:sockets)socket.close();threads.shutdownNow();
            try{assertTrue(threads.awaitTermination(10,TimeUnit.SECONDS));}catch(InterruptedException stopped){Thread.currentThread().interrupt();}
        }
    }
}
