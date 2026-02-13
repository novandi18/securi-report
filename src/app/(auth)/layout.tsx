import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

export const metadata: Metadata = {
  title: "Login | DEIT REPORTING",
  description: "Sign in to DEIT REPORTING",
};

export default function AuthLayout({ children }: PropsWithChildren) {
  return <>{children}</>;
}
