import { requestMetadata } from "@/lib/i18n/server";
import { metadata } from "@/app/(fr)/demonstrations/cls/[variant]/page";
export { default, generateStaticParams } from "@/app/(fr)/demonstrations/cls/[variant]/page";
export const dynamicParams = false;
export async function generateMetadata() { return requestMetadata(metadata); }
