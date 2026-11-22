import { DepartmentPage, departmentMetadata } from "@/components/shop/department-page";

export const dynamic = "force-dynamic";
export const generateMetadata = () => departmentMetadata("grocery");

export default function GroceryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <DepartmentPage department="grocery" searchParams={searchParams} />;
}
