package com.dokor.argos.services.ci;
import com.dokor.argos.services.token.TokenService;
import java.util.HashSet;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CiKeyMaterialTest {
    private final TokenService tokens=new TokenService();
    @Test void generatesIndependentIdentifiersAnd256BitSecretsWithHashOnly() {
        var values=new HashSet<String>();
        for(int n=0;n<100;n++) {
            var key=CiKeyMaterial.generate(tokens);
            assertTrue(values.add(key.publicId()));assertTrue(values.add(key.credential()));
            assertEquals(32,java.util.Base64.getUrlDecoder().decode(key.credential().substring(42)).length);
            assertEquals(key.credential(),CiKeyMaterial.credential("Bearer "+key.credential()));
            assertEquals(32,key.hash().length);
            assertArrayEquals(tokens.sha256(key.credential()),key.hash());
            assertTrue(CiKeyMaterial.matches(tokens,key.credential(),key.hash()));
            assertFalse(CiKeyMaterial.matches(tokens,key.credential(),null));
            assertFalse(key.toString().contains(key.credential()));
        }
    }
    @Test void cannotSubstituteSessionsReportTokensOrOtherCredentialForms() {
        for(String header:new String[]{null,"","Bearer browser.jwt.session","Bearer "+tokens.generateToken(),"Basic admin","Bearer "+"x".repeat(100000)})
            assertNull(CiKeyMaterial.credential(header));
        assertFalse(CiKeyMaterial.matches(tokens,null,null));
    }
}
