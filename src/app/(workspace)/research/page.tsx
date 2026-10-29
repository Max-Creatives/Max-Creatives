import { pageUser } from "@/lib/auth";
import { ResearchCenter } from "@/components/research-center";
export const metadata = { title: "Research Agent" };
export default async function ResearchPage() {
  await pageUser();
  return <ResearchCenter />;
}
