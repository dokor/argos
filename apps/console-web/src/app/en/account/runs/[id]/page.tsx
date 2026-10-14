import { Suspense } from "react";
import PersonalReport from "@/components/account/PersonalReport";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <Suspense><PersonalReport runId={(await params).id} /></Suspense>; }
