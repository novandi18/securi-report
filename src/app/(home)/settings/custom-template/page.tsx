import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomTemplate } from "@/lib/actions/template-actions";
import { redirect } from "next/navigation";
import CustomTemplateClient from "./_components/custom-template-client";

export const metadata = { title: "Custom Report Template" };

export default async function CustomTemplatePage() {
  const result = await getCustomTemplate();

  if (!result.success && result.error === "Access denied") {
    redirect("/");
  }

  return (
    <>
      <Breadcrumb pageName="Custom Report Template" />
      <CustomTemplateClient template={result.data ?? null} />
    </>
  );
}
