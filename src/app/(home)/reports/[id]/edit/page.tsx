import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import {
  getReportAction,
  getCustomersForSelectAction,
  updateReportAction,
} from "@/lib/actions/report";
import { getAttachmentsAction } from "@/lib/actions/attachment";
import { auth } from "@/lib/auth";
import ReportForm from "../../_components/report-form";

export const metadata = {
  title: "Edit Finding Report",
};

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  // Viewer cannot edit reports
  if (!session || session.user.role === "viewer") {
    redirect("/reports");
  }

  const { id } = await params;

  const [reportResult, customersResult, attachmentsResult] = await Promise.all([
    getReportAction(id),
    getCustomersForSelectAction(),
    getAttachmentsAction(id),
  ]);

  if (!reportResult.data) {
    notFound();
  }

  // Editor can only edit draft reports
  if (
    session.user.role === "editor" &&
    reportResult.data.status !== "Draft"
  ) {
    redirect("/reports");
  }

  return (
    <>
      <Breadcrumb pageName="Edit Finding Report" />
      <ReportForm
        report={reportResult.data}
        customers={customersResult.data}
        initialAttachments={attachmentsResult.data.map((a) => ({
          id: a.id,
          fileUrl: a.fileUrl,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        }))}
        serverAction={updateReportAction}
      />
    </>
  );
}
