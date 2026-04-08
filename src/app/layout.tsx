import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { PageHeaderProvider } from "@/contexts/page-header-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ConditionalDashboardShell } from "@/components/conditional-dashboard-shell";

const THEME_INIT_SCRIPT = `!function(){try{var k='gestor-theme';var s=localStorage.getItem(k);var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}}();`;

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
  icons: { icon: "/favicon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen w-full min-w-0 overflow-x-hidden overflow-y-auto bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100`}
      >
        {/* Fundo animado sutil: brilho radial claro */}
        <div className="layout-bg-glow" aria-hidden />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <ThemeProvider>
              <AuthProvider>
                <PageHeaderProvider>
                  <ConditionalDashboardShell>{children}</ConditionalDashboardShell>
                </PageHeaderProvider>
              </AuthProvider>
            </ThemeProvider>
          </div>
        </div>
      </body>
    </html>
  );
}

