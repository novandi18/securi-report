import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getDeliverablesAction } from "@/lib/actions/deliverable";
import DeliverablesClient from "./_components/deliverables-client";

export const metadata = {
  title: "Deliverables",
};

export default async function DeliverablesPage() {
  const result = await getDeliverablesAction();

  return (
    <>
      <Breadcrumb pageName="Deliverables" />
      <DeliverablesClient deliverables={result.data} />
    </>
  );
}
