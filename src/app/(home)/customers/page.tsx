import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { getCustomersAction } from "@/lib/actions/customer";
import CustomersClient from "./_components/customers-client";

export const metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  const result = await getCustomersAction();

  return (
    <>
      <Breadcrumb pageName="Customers" />
      <CustomersClient customers={result.data} />
    </>
  );
}
