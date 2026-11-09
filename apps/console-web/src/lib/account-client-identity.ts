import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** Only our authenticated ingress may supply the final XFF hop (its TCP client). */
export function accountClientHeaders(incoming: Headers, outgoing: Headers): void {
  const secret = process.env.ARGOS_ACCOUNT_PROXY_SECRET ?? "";
  const edgeKey = incoming.get("x-argos-edge-key") ?? "";
  if (!/^[a-f0-9]{64}$/.test(secret) || !/^[a-f0-9]{64}$/.test(edgeKey)
      || !timingSafeEqual(Buffer.from(edgeKey), Buffer.from(secret))) return;

  const forwarded = incoming.get("x-forwarded-for") ?? "";
  if (forwarded.length > 4096) return;
  const client = forwarded.slice(forwarded.lastIndexOf(",") + 1).trim();
  if (client.includes("%") || !isIP(client)) return;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const proof = createHmac("sha256", secret).update(`argos-client-v1\n${timestamp}\n${client}`).digest("hex");
  outgoing.set("X-Argos-Client-IP", client);
  outgoing.set("X-Argos-Client-Proof", `${timestamp}.${proof}`);
}
