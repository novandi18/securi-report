import "@/css/satoshi.css";
import "@/css/style.css";

import { Sidebar } from "@/components/Layouts/sidebar";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import { Header } from "@/components/Layouts/header";
import { Footer } from "@/components/Layouts/footer";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: {
    template: "%s | DEIT REPORTING",
    default: "DEIT REPORTING",
  },
  description:
    "DEIT REPORTING - Professional penetration testing report management and collaboration tool.",
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const session = await auth();
  const isAuthenticated = !!session?.user;

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SessionProvider session={session}>
          <Providers>
            <NextTopLoader color="#5750F1" showSpinner={false} />

            {isAuthenticated ? (
              <div className="flex min-h-screen">
                <Sidebar />

                <div className="flex min-h-screen w-full flex-col bg-gray-2 dark:bg-[#020d1a]">
                  <Header />

                  <main className="relative mx-auto w-full max-w-screen-2xl flex-1 overflow-hidden p-4 md:p-6 2xl:p-10">
                    {children}
                  </main>

                  <Footer />
                </div>
              </div>
            ) : (
              <div className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
                {children}
              </div>
            )}
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}
