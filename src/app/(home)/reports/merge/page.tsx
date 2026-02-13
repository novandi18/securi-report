import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { auth } from "@/lib/auth";
import { getDraftContributionsAction } from "@/lib/actions/merge";
import MergeClient from "./_components/merge-client";

export const metadata = {
  title: "Merge Reports",
};

export default async function MergeReportsPage() {
  const session = await auth();

  // Only admin can access merge
  if (!session || session.user.role !== "administrator") {
    redirect("/reports");
  }

  const result = await getDraftContributionsAction();

  return (
    <>
      <Breadcrumb pageName="Merge Contributions" />
      <MergeClient groups={result.data} />
    </>
  );
}
