import QueueView from "@/components/admin/QueueView";
import type { QueueType } from "@/components/admin/queueCopy";
import { notFound } from "next/navigation";
export default async function Page({params}: {params: Promise<{type: string; id: string}>}) {
  const {type,id} = await params;
  if (!["DISCOVERY","BATCH","RUN"].includes(type) || !/^[1-9]\d{0,18}$/.test(id)) notFound();
  return <QueueView type={type as QueueType} id={id}/>;
}
