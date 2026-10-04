import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { ToastProvider } from "@/components/Toast";
import { TutorWidget } from "@/components/tutor/TutorWidget";
import { getVocabCounts } from "@/lib/stats";
import { diffDays, today } from "@/lib/dates";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Band Up · IELTS study hub",
  description: "Phrase-based IELTS vocabulary learning, skill practice, library and AI tutor.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const vocab = await getVocabCounts();
  const daysLeft = vocab.settings.examDate ? diffDays(today(), vocab.settings.examDate) : null;

  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plex.variable}`}>
      <body>
        <ToastProvider>
          <div className="flex min-h-screen flex-wrap items-start bg-ground text-ink">
            <Sidebar
              dueBadge={vocab.reviewToday + vocab.newToday}
              targetBand={vocab.settings.targetBand}
              daysLeft={daysLeft}
            />
            <main className="min-w-0 box-border" style={{ flex: "999 1 560px", padding: "32px clamp(16px, 3vw, 40px) 96px" }}>
              <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
                <PageHeader />
                {children}
              </div>
            </main>
          </div>
          <TutorWidget />
        </ToastProvider>
      </body>
    </html>
  );
}
