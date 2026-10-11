package com.dokor.argos.jersey;

import com.coreoz.plume.jersey.errors.JsonRequestParseException;
import com.fasterxml.jackson.jakarta.rs.json.JacksonJsonProvider;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;

import java.io.IOException;
import java.io.InputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.Type;

/** Preserve Plume's 400 contract without logging parser excerpts from credentials. */
public class SafeJsonProvider extends JacksonJsonProvider {
    @Override
    public Object readFrom(
            Class<Object> type,
            Type genericType,
            Annotation[] annotations,
            MediaType mediaType,
            MultivaluedMap<String, String> headers,
            InputStream stream)
            throws IOException {
        try {
            return super.readFrom(type, genericType, annotations, mediaType, headers, stream);
        } catch (IOException invalid) {
            throw new JsonRequestParseException();
        }
    }
}
