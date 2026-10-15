import { createEgressProxy } from './proxy.mjs';
createEgressProxy().listen(3128,'0.0.0.0');
