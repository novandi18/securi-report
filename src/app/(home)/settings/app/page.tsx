import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getAppSettingsAction } from "@/lib/actions/settings";
import { redirect } from "next/navigation";
import AppSettingsClient from "./_components/app-settings-client";

export const metadata = {
  title: "Application Settings",
};

export default async function AppSettingsPage() {
  const result = await getAppSettingsAction();

  if (!result.success || !result.data) {
    redirect("/");
  }

  return (
    <>
      <Breadcrumb pageName="Application Settings" />
      <AppSettingsClient settings={result.data} />
    </>
  );
}
