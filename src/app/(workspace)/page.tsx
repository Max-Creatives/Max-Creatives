import { pageUser } from "@/lib/auth";
import { workspaceStats } from "@/lib/queries";
import { Overview } from "@/components/overview";
export default async function Home() {
  const user = await pageUser();
  return <Overview stats={await workspaceStats(user.id)} />;
}
