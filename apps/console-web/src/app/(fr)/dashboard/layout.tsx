import type { Metadata } from "next";

// Dashboard is auth-gated and must never appear in search results.
export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
