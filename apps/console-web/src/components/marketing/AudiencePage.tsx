import SmallBusinessPage from "./SmallBusinessPage";
import EcommercePage from "./EcommercePage";
export default function AudiencePage({ audience }: { audience: "pme" | "ecommerce" }) {
  return audience === "pme" ? <SmallBusinessPage /> : <EcommercePage />;
}
