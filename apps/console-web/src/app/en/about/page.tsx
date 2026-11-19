import { requestMetadata } from "@/lib/i18n/server";
import AboutPage from "@/components/marketing/AboutPage";
import { localizedMetadata } from "@/lib/i18n/metadata";
export async function generateMetadata() { return requestMetadata(localizedMetadata("/a-propos", "en", "About Argos and its creator", "Learn who operates Argos, its purpose, scoring method and how to contact Antoine Le Louët.")); }
export default AboutPage;
