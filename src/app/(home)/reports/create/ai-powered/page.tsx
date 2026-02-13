import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomersForSelectAction } from "@/lib/actions/report";
import { auth } from "@/lib/auth";
import AIReportForm from "./_components/ai-report-form";

export const metadata = {
  title: "Create Report — AI Powered",
};

export default async function AICreateReportPage() {
  const session = await auth();

  if (!session || session.user.role === "viewer") {
    redirect("/reports");
  }

  const customersResult = await getCustomersForSelectAction();

  return (
    <>
      <Breadcrumb pageName="AI-Powered Report" />
      <AIReportForm customers={customersResult.data} />
    </>
  );
}
