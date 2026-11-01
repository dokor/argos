/** Bound decoded bytes before JSON parsing, including chunked requests without Content-Length. */
export async function boundedJson(request: Pick<Request, "headers" | "body">, maxBytes = 8192, signal?: AbortSignal): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new RangeError("Payload too large");
  if (!request.body) throw new SyntaxError("Missing JSON body");
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  if(signal?.aborted) cancel();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RangeError("Payload too large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { signal?.removeEventListener("abort", cancel); reader.releaseLock(); }
}
