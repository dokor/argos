import PersonalReport from "@/components/account/PersonalReport";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <PersonalReport runId={(await params).id} />; }
