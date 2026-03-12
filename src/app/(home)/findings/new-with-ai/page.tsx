import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomersForSelectAction } from "@/lib/actions/report";
import { auth } from "@/lib/auth";
import AIReportForm from "../../reports/create/ai-powered/_components/ai-report-form";

export const metadata = {
  title: "New Finding — AI Powered",
};

export default async function NewFindingWithAIPage() {
  const session = await auth();

  if (!session || session.user.role === "viewer") {
    redirect("/findings");
  }

  const customersResult = await getCustomersForSelectAction();

  return (
    <>
      <Breadcrumb pageName="New Finding with AI" />
      <AIReportForm customers={customersResult.data} />
    </>
  );
}
