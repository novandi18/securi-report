import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { auth } from "@/lib/auth";
import { createTemplateAction } from "@/lib/actions/template";
import { getFrameworksForSelectAction } from "@/lib/actions/template";
import TemplateForm from "../_components/template-form";

export const metadata = {
  title: "Add Finding Template",
};

export default async function AddTemplatePage() {
  const session = await auth();

  // Viewer cannot create templates
  if (!session || session.user.role === "viewer") {
    redirect("/kb/templates");
  }

  const frameworksResult = await getFrameworksForSelectAction();

  return (
    <>
      <Breadcrumb pageName="Add Finding Template" />
      <TemplateForm
        cweList={frameworksResult.cweList}
        owaspList={frameworksResult.owaspList}
        serverAction={createTemplateAction}
      />
    </>
  );
}
