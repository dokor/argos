import { requestMetadata } from "@/lib/i18n/server";
import FeedbackPage from "@/components/feedback/FeedbackPage";
export async function generateMetadata() { return requestMetadata({ title: "Your feedback | Argos", robots: { index: false, follow: false } }); }
export default FeedbackPage;
