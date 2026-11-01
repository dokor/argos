import { notFound } from "next/navigation";
import DeveloperDocs from "@/components/docs/DeveloperDocs";
import { docsMetadata, isTopic } from "@/components/docs/metadata";
type Props={params:Promise<{topic:string}>};
export async function generateMetadata({params}:Props){const {topic}=await params;return isTopic(topic)?docsMetadata(topic,"en"):{};}
export default async function Page({params}:Props){const {topic}=await params;if(!isTopic(topic))notFound();return <DeveloperDocs topic={topic}/>;}
