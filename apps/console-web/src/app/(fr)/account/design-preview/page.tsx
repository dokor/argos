import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import FoundationPreview, { type PreviewFixture } from "@/components/connected/FoundationPreview";
export default async function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.ARGOS_CONNECTED_PREVIEW !== "1") notFound();
  const fixture: PreviewFixture = JSON.parse(await readFile(path.resolve(process.cwd(), "../../docs/connected-space/fixtures/connected-space.json"), "utf8"));
  return <FoundationPreview fixture={fixture}/>;
}
