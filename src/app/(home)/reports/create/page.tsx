import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomersForSelectAction, createReportAction } from "@/lib/actions/report";
import { getTemplatesAction } from "@/lib/actions/template";
import { auth } from "@/lib/auth";
import ReportForm from "../_components/report-form";

export const metadata = {
  title: "Create Report",
};

export default async function CreateReportPage() {
  const session = await auth();

  // Viewer cannot create reports
  if (!session || session.user.role === "viewer") {
    redirect("/reports");
  }

  const [customersResult, templatesResult] = await Promise.all([
    getCustomersForSelectAction(),
    getTemplatesAction(),
  ]);

  return (
    <>
      <Breadcrumb pageName="Create Report" />
      <ReportForm
        customers={customersResult.data}
        templates={templatesResult.data}
        serverAction={createReportAction}
      />
    </>
  );
}
