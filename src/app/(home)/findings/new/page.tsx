import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomersForSelectAction, createReportAction } from "@/lib/actions/report";
import { auth } from "@/lib/auth";
import FindingForm from "../_components/finding-form";

export const metadata = {
  title: "New Finding",
};

export default async function NewFindingPage() {
  const session = await auth();

  if (!session || session.user.role === "viewer") {
    redirect("/findings");
  }

  const customersResult = await getCustomersForSelectAction();

  return (
    <>
      <Breadcrumb pageName="New Finding" />
      <FindingForm
        customers={customersResult.data}
        serverAction={createReportAction}
      />
    </>
  );
}
