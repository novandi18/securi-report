import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getTemplatesAction } from "@/lib/actions/template";
import TemplatesClient from "./_components/templates-client";

export const metadata = {
  title: "Finding Templates",
};

export default async function TemplatesPage() {
  const result = await getTemplatesAction();

  return (
    <>
      <Breadcrumb pageName="Finding Templates" />
      <TemplatesClient templates={result.data} />
    </>
  );
}
