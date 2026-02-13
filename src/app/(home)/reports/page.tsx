import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getReportsAction } from "@/lib/actions/report";
import ReportsClient from "./_components/reports-client";

export const metadata = {
  title: "Reports",
};

export default async function ReportsPage() {
  const result = await getReportsAction();

  return (
    <>
      <Breadcrumb pageName="Reports" />
      <ReportsClient reports={result.data} />
    </>
  );
}
