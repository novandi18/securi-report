import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getProfileAction, getAuditLogsAction } from "@/lib/actions/settings";
import { redirect } from "next/navigation";
import AccountSettingsClient from "./_components/account-settings-client";

export const metadata = {
  title: "Account Settings",
};

export default async function AccountSettingsPage() {
  const [profileResult, logsResult] = await Promise.all([
    getProfileAction(),
    getAuditLogsAction(),
  ]);

  if (!profileResult.success || !profileResult.data) {
    redirect("/login");
  }

  return (
    <>
      <Breadcrumb pageName="Account Settings" />
      <AccountSettingsClient
        profile={profileResult.data}
        auditLogs={logsResult.data ?? []}
      />
    </>
  );
}
