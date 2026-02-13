import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import {
  getCweEntriesAction,
  getOwaspEntriesAction,
} from "@/lib/actions/framework";
import FrameworksClient from "./_components/frameworks-client";

export const metadata = {
  title: "CWE/OWASP Frameworks",
};

export default async function FrameworksPage() {
  const [cweResult, owaspResult] = await Promise.all([
    getCweEntriesAction(),
    getOwaspEntriesAction(),
  ]);

  return (
    <>
      <Breadcrumb pageName="CWE/OWASP Frameworks" />
      <FrameworksClient
        cweEntries={cweResult.data}
        owaspEntries={owaspResult.data}
      />
    </>
  );
}
