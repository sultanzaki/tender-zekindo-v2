import { GeistSans } from "geist/font/sans";
import { cookies } from "next/headers";
import type { Metadata, Viewport } from "next";
import "./theme.css";
import "./globals.css";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getAuthContext } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tender Management — Zekindo",
  description:
    "Monitoring and management of oil & gas tenders for PT Zeus Kimiatama Indonesia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();

  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        {ctx ? (
          <WorkspaceShell
            defaultSidebarOpen={
              (await cookies()).get("sidebar_state")?.value !== "false"
            }
            profile={ctx.profile}
          >
            {children}
          </WorkspaceShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
