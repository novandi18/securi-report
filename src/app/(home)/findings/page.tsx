import { Suspense } from "react";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getReportsAction } from "@/lib/actions/report";
import FindingsClient from "./_components/findings-client";

export const metadata = {
  title: "Findings",
};

export default async function FindingsPage() {
  const result = await getReportsAction();

  return (
    <>
      <Breadcrumb pageName="Findings" />
      <Suspense>
        <FindingsClient findings={result.data} />
      </Suspense>
    </>
  );
}
