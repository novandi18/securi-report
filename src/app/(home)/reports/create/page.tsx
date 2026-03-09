import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomersForSelectAction, createReportAction } from "@/lib/actions/report";
import { auth } from "@/lib/auth";
import ReportForm from "../_components/report-form";

export const metadata = {
  title: "Create Finding Report",
};

export default async function CreateReportPage() {
  const session = await auth();

  // Viewer cannot create reports
  if (!session || session.user.role === "viewer") {
    redirect("/reports");
  }

  const customersResult = await getCustomersForSelectAction();

  return (
    <>
      <Breadcrumb pageName="Create Finding Report" />
      <ReportForm
        customers={customersResult.data}
        serverAction={createReportAction}
      />
    </>
  );
}
