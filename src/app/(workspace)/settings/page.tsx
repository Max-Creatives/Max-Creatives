import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/settings-form";
export const metadata = { title: "Settings" };
export default async function Settings() {
  const user = await pageUser();
  const [settings, suppressed] = await Promise.all([
    db.workspaceSettings.findUnique({ where: { userId: user.id } }),
    db.suppression.count({ where: { userId: user.id } }),
  ]);
  return (
    <SettingsForm
      settings={
        settings || {
          senderName: "Max",
          postalAddress: "",
          mode: "research_only",
          monthlyBudget: 10,
        }
      }
      suppressed={suppressed}
    />
  );
}
