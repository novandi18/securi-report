import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChangePasswordClient from "./_components/change-password-client";

export const metadata = {
  title: "Change Password",
};

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <Breadcrumb pageName="Change Password" />
      <ChangePasswordClient
        mustChangePassword={session.user.mustChangePassword ?? false}
      />
    </>
  );
}
