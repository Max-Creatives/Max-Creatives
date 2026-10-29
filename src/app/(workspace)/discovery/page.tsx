import { pageUser } from "@/lib/auth";
import { ResearchCenter } from "@/components/research-center";
export const metadata = { title: "Email Discovery" };
export default async function DiscoveryPage() {
  await pageUser();
  return <ResearchCenter discovery />;
}
