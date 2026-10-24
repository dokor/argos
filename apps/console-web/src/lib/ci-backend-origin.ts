/** Trusted server configuration only. Internal HTTP is intentional; target URLs never enter here. */
export function ciBackendOrigin(): string {
  const configured=process.env.API_BASE??"http://api-backend:8081";
  const origin=new URL(configured);
  if(!["http:","https:"].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash
    || (configured!==origin.origin && configured!==origin.origin+"/"))throw new Error("Invalid CI backend configuration");
  return origin.origin;
}
