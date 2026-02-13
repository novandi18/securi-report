import { redirect, notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { auth } from "@/lib/auth";
import {
  getTemplateAction,
  updateTemplateAction,
  getFrameworksForSelectAction,
} from "@/lib/actions/template";
import TemplateForm from "../../_components/template-form";

export const metadata = {
  title: "Edit Finding Template",
};

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  // Viewer cannot edit templates
  if (!session || session.user.role === "viewer") {
    redirect("/kb/templates");
  }

  const { id } = await params;

  const [templateResult, frameworksResult] = await Promise.all([
    getTemplateAction(id),
    getFrameworksForSelectAction(),
  ]);

  if (!templateResult.data) {
    notFound();
  }

  return (
    <>
      <Breadcrumb pageName="Edit Finding Template" />
      <TemplateForm
        template={templateResult.data}
        cweList={frameworksResult.cweList}
        owaspList={frameworksResult.owaspList}
        serverAction={updateTemplateAction}
      />
    </>
  );
}
