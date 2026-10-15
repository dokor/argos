package com.dokor.argos.services.analysis.modules.observatory;

import com.dokor.argos.services.analysis.ExternalHttpClient;
import com.dokor.argos.services.configuration.ConfigurationService;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ObservatoryClientTest {
    @Test void removedV1DetailsEndpointIsNeverRequested() throws Exception {
        var transport = mock(ExternalHttpClient.class); var config = mock(ConfigurationService.class);
        when(config.observatoryApiUrl()).thenReturn("https://observatory-api.mdn.mozilla.net/api/v2");
        assertTrue(new ObservatoryClient(transport, config).tests(123).isEmpty());
        verifyNoInteractions(transport);
    }
}
