import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getProfileAction, getProfileStatsAction } from "@/lib/actions/settings";
import { redirect } from "next/navigation";
import ProfileClient from "./_components/profile-client";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const [profileResult, statsResult] = await Promise.all([
    getProfileAction(),
    getProfileStatsAction(),
  ]);

  if (!profileResult.success || !profileResult.data) {
    redirect("/login");
  }

  return (
    <>
      <Breadcrumb pageName="Profile" />
      <ProfileClient
        profile={profileResult.data}
        stats={statsResult.success ? statsResult.data : null}
      />
    </>
  );
}
