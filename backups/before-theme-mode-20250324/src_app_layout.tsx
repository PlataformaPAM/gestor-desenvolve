import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { PageHeaderProvider } from "@/contexts/page-header-context";
import { ConditionalDashboardShell } from "@/components/conditional-dashboard-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor Desenvolve - Sistema Integrado de Gestão",
  description: "Sistema Integrado de Gestão - Gestor Desenvolve.",
  icons: { icon: "/desenvolve_icone-f.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="icon" type="image/png" href="/desenvolve_icone-f.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen w-full min-w-0 overflow-y-auto bg-slate-50 text-slate-900`}
      >
        {/* Fundo animado sutil: brilho radial claro */}
        <div className="layout-bg-glow" aria-hidden />
        <div className="flex flex-1 min-w-0 min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <AuthProvider>
            <PageHeaderProvider>
              <ConditionalDashboardShell>{children}</ConditionalDashboardShell>
            </PageHeaderProvider>
          </AuthProvider>
          </div>
        </div>
      </body>
    </html>
  );
}

