package com.dokor.argos.services.connected.contract;

import com.fasterxml.jackson.core.*;
import com.fasterxml.jackson.databind.*;
import java.io.IOException;

/** Request limits must be JSON integers: reject strings, fractions, booleans and overflow. */
public final class StrictLongDeserializer extends JsonDeserializer<Long> {
    @Override public Long deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT))
            return (Long) context.handleUnexpectedToken(Long.class, parser);
        return parser.getLongValue();
    }
}
