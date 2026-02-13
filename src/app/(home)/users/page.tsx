import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { auth } from "@/lib/auth";
import { getUsersAction } from "@/lib/actions/user";
import { redirect } from "next/navigation";
import UsersClient from "./_components/users-client";

export const metadata = {
  title: "Users",
};

export default async function UsersPage() {
  const session = await auth();

  // Server-side admin check
  if (!session || session.user.role !== "administrator") {
    redirect("/");
  }

  const result = await getUsersAction();

  return (
    <>
      <Breadcrumb pageName="Users" />
      <UsersClient users={result.data} currentUserId={session.user.id!} />
    </>
  );
}
