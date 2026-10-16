package com.dokor.argos.services.analysis.modules.tech;

import java.time.Instant;
import java.util.*;

/** Passive response signatures. Headers are assertions, never proof of a physical origin. */
public final class HostingDetector {
    private HostingDetector() {}
    public record Provider(String name, String confidence, List<String> evidence) {}
    public record Hosting(String method, String observedAt, Provider applicationHost,
                          List<Provider> cdnProxies, Provider networkProvider, String originStatus) {}

    public static Hosting detect(Map<String,String> responseHeaders) {
        Map<String,String> headers = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        if(responseHeaders!=null) responseHeaders.forEach((k,v)->{if(k!=null&&v!=null&&!v.isBlank())headers.put(k,v);});
        var candidates = new ArrayList<Provider>();
        if(headers.containsKey("x-vercel-id")) candidates.add(new Provider("Vercel","MEDIUM",List.of("x-vercel-id present")));
        if(headers.containsKey("x-nf-request-id")) candidates.add(new Provider("Netlify","MEDIUM",List.of("x-nf-request-id present")));
        var proxies = new ArrayList<Provider>();
        String server = headers.getOrDefault("server","").toLowerCase(Locale.ROOT).trim();
        if(headers.containsKey("cf-ray") || "cloudflare".equals(server)) {
            var evidence = new ArrayList<String>();
            if(headers.containsKey("cf-ray")) evidence.add("cf-ray present");
            if("cloudflare".equals(server)) evidence.add("server = cloudflare");
            proxies.add(new Provider("Cloudflare","MEDIUM",List.copyOf(evidence)));
        }
        if(headers.containsKey("x-amz-cf-id")) proxies.add(new Provider("Amazon CloudFront","MEDIUM",List.of("x-amz-cf-id present")));
        // Conflicting platform signatures cannot identify an application host.
        Provider applicationHost = candidates.size()==1 ? candidates.getFirst() : null;
        return new Hosting("HTTP_HEADERS_V1",Instant.now().toString(),applicationHost,List.copyOf(proxies),null,
            candidates.size()>1 ? "CONFLICTING_SIGNALS" : applicationHost!=null ? "PROBABLE_PLATFORM" : "UNKNOWN");
    }
}
