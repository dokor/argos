package com.dokor.argos.services.ci;
import com.dokor.argos.services.token.TokenService;
import java.security.MessageDigest;
import java.util.UUID;
/** 256 random secret bits; the identifier is public and independent of the secret. */
public final class CiKeyMaterial {
    public record Created(String publicId,String credential,byte[] hash) {
        @Override public String toString() { return "CiKeyMaterial[redacted]"; }
    }
    private CiKeyMaterial() {}
    public static Created generate(TokenService tokens) {
        String id=UUID.randomUUID().toString().replace("-","");
        String credential="argos_ci_"+id+"."+tokens.generateToken();
        return new Created(id,credential,tokens.sha256(credential));
    }
    public static String credential(String authorization) {
        return authorization!=null && authorization.matches("Bearer argos_ci_[a-f0-9]{32}\\.[A-Za-z0-9_-]{43}")
            ? authorization.substring(7) : null;
    }
    public static boolean matches(TokenService tokens,String credential,byte[] expected) {
        byte[] actual=tokens.sha256(credential==null ? "invalid-ci-credential" : credential);
        return MessageDigest.isEqual(expected==null ? new byte[32] : expected,actual) && expected!=null && credential!=null;
    }
}
