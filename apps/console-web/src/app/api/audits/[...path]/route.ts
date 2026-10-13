import { GET as retiredRead } from "../route";

// Keep the old numeric read paths closed ahead of the generic backend rewrite.
export const GET = retiredRead;
