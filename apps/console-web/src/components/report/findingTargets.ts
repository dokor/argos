/** Exact document/header locations implied by these checks, including absent elements. */
export const headerTargets: Record<string,string> = {
  'http.security.hsts':'Strict-Transport-Security', 'http.security.csp':'Content-Security-Policy',
  'http.security.x_content_type_options':'X-Content-Type-Options', 'http.security.x_frame_options':'X-Frame-Options',
  'http.security.referrer_policy':'Referrer-Policy', 'http.security.permissions_policy':'Permissions-Policy',
  'http.security.cookie_flags':'Set-Cookie', 'zap.alert.10010':'Set-Cookie', 'zap.alert.10011':'Set-Cookie',
  'zap.alert.10054':'Set-Cookie', 'zap.alert.10036':'Server', 'zap.alert.10037':'X-Powered-By',
};
export const documentTargets: Record<string,string> = {
  'html.title':'head > title', 'html.meta.description.present':'head > meta[name="description"]',
  'html.link.canonical.present':'head > link[rel="canonical"]', 'html.meta.viewport.present':'head > meta[name="viewport"]',
  'html.meta.charset.present':'head > meta[charset], head > meta[http-equiv="Content-Type"]',
  'html.h1.count':'h1', 'html.lang':'html[lang]', 'html.doctype.html5':'<!doctype html>',
  'html.social.meta':'head > meta[property^="og:"], head > meta[name="twitter:card"]',
  'lighthouse.audit.meta-description':'head > meta[name="description"]',
  'lighthouse.audit.viewport-insight':'head > meta[name="viewport"]', 'lighthouse.audit.doctype':'<!doctype html>',
};
export function isPageTiming(key?: string|null) {
  return ['lighthouse.audit.first-contentful-paint','lighthouse.audit.speed-index'].includes(key??'');
}
