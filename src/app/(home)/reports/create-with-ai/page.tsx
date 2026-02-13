import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomersForSelectAction } from "@/lib/actions/report";
import { auth } from "@/lib/auth";
import AIReportForm from "../create/ai-powered/_components/ai-report-form";

export const metadata = {
  title: "Create Report — AI Powered",
};

export default async function CreateWithAIPage() {
  const session = await auth();

  if (!session || session.user.role === "viewer") {
    redirect("/reports");
  }

  const customersResult = await getCustomersForSelectAction();

  return (
    <>
      <Breadcrumb pageName="Create with AI" />
      <AIReportForm customers={customersResult.data} />
    </>
  );
}
