import HistoryView from "@/components/account/HistoryView";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HistoryView key={id} urlId={id}/>;
}
