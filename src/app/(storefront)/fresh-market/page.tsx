import { DepartmentPage, departmentMetadata } from "@/components/shop/department-page";

export const dynamic = "force-dynamic";
export const generateMetadata = () => departmentMetadata("fresh");

export default function FreshMarketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <DepartmentPage department="fresh" searchParams={searchParams} />;
}
