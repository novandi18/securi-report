import type { Metadata } from "next";
import { getCustomersForDashboardAction } from "@/lib/actions/dashboard";
import DashboardClient from "./_components/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Home() {
  const customersResult = await getCustomersForDashboardAction();

  return (
    <DashboardClient customers={customersResult.data} />
  );
}
