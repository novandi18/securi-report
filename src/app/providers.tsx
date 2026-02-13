"use client";

import { SidebarProvider } from "@/components/Layouts/sidebar/sidebar-context";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" attribute="class">
      <SidebarProvider>
        <ToastProvider>{children}</ToastProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
