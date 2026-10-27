/** Exact document/header locations implied by these checks, including absent elements. */
export const headerTargets: Record<string,string> = {
  'http.security.hsts':'Strict-Transport-Security', 'http.security.csp':'Content-Security-Policy',
  'http.security.x_content_type_options':'X-Content-Type-Options', 'http.security.x_frame_options':'X-Frame-Options',
  'http.security.referrer_policy':'Referrer-Policy', 'http.security.permissions_policy':'Permissions-Policy',
  'http.security.cookie_flags':'Set-Cookie', 'zap.alert.10010':'Set-Cookie', 'zap.alert.10011':'Set-Cookie',
  'zap.alert.10054':'Set-Cookie', 'zap.alert.10036':'Server', 'zap.alert.10037':'X-Powered-By',
  'http.headers.content_type':'Content-Type', 'http.headers.compression':'Content-Encoding',
  'http.headers.caching':'Cache-Control / Expires', 'http.headers.server':'Server', 'zap.alert.10098':'Access-Control-Allow-Origin / Access-Control-Allow-Credentials',
};
export const documentTargets: Record<string,string> = {
  'html.title':'head > title', 'html.meta.description.present':'head > meta[name="description"]',
  'html.link.canonical.present':'head > link[rel="canonical"]', 'html.meta.viewport.present':'head > meta[name="viewport"]',
  'html.meta.charset.present':'head > meta[charset], head > meta[http-equiv="Content-Type"]',
  'html.h1.count':'h1', 'html.lang':'html[lang]', 'html.doctype.html5':'<!doctype html>',
  'html.social.meta':'head > meta[property^="og:"], head > meta[name="twitter:card"]',
  'lighthouse.audit.meta-description':'head > meta[name="description"]',
  'lighthouse.audit.viewport-insight':'head > meta[name="viewport"]', 'lighthouse.audit.doctype':'<!doctype html>',
  'html.meta.robots.present':'head > meta[name="robots"]',
  'lighthouse.audit.document-title':'head > title', 'lighthouse.audit.charset':'Content-Type: charset / head > meta[charset]',
  'lighthouse.audit.canonical':'head > link[rel="canonical"] / HTTP Link',
  'lighthouse.audit.hreflang':'head > link[rel="alternate"][hreflang] / HTTP Link',
  'lighthouse.audit.is-crawlable':'head > meta[name="robots"], meta[name="googlebot"] / HTTP X-Robots-Tag / robots.txt',
  'lighthouse.audit.meta-viewport':'head > meta[name="viewport"]', 'lighthouse.audit.meta-refresh':'head > meta[http-equiv="refresh"]',
};
export const pageTargets: Record<string,[string,string]> = {
  'http.status_code':['Statut de la réponse finale du document dans Réseau','Status of the final document response in Network'],
  'lighthouse.audit.http-status-code':['Statut de la réponse finale du document dans Réseau','Status of the final document response in Network'],
  'http.final_url.https':['Schéma HTTP/HTTPS de la destination finale','HTTP/HTTPS scheme of the final destination'],
  'http.redirect.to_https':['Redirection de l’adresse HTTP demandée vers HTTPS','Redirect from the requested HTTP address to HTTPS'],
  'http.redirect.count':['Chaîne de navigation : réponses 3xx et en-têtes Location','Navigation chain: 3xx responses and Location headers'],
  'lighthouse.audit.redirects-http':['Redirection de l’adresse HTTP demandée vers HTTPS','Redirect from the requested HTTP address to HTTPS'],
  'lighthouse.audit.document-latency-insight':['Document principal : chronologie, redirections et Content-Encoding','Main document: timing, redirects and Content-Encoding'],
  'lighthouse.audit.server-response-time':['Document principal : attente de la réponse dans Réseau','Main document: response waiting in Network'],
  'lighthouse.audit.bf-cache':['Page et cadres : Application → Cache arrière/avant','Page and frames: Application → Back/forward cache'],
  'runtime.network.request_count':['Requêtes de la page entière : Réseau, cache désactivé, même parcours','Whole-page requests: Network, cache disabled, same journey'],
  'html.size.bytes':['Poids du document HTML reçu avant exécution JavaScript','Size of the received HTML document before JavaScript execution'],
  'html.scripts.count':['Balises script dans le HTML reçu','Script elements in the received HTML'],
};
export function isPageTiming(key?: string|null) {
  return ['lighthouse.audit.first-contentful-paint','lighthouse.audit.speed-index'].includes(key??'');
}
