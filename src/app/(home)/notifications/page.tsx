import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotificationsAction } from "@/lib/actions/notification";
import { NotificationsClient } from "./_components/notifications-client";

export const metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const result = await getNotificationsAction(200);

  return (
    <>
      <Breadcrumb pageName="Notifications" />
      <NotificationsClient notifications={result.data} />
    </>
  );
}
