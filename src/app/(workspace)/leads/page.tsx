import { pageUser } from "@/lib/auth";
import { queryLeads } from "@/lib/queries";
import { db } from "@/lib/db";
import { LeadTable } from "@/components/lead-table";
export const metadata = { title: "Leads" };
export default async function Leads({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await pageUser();
  const [result, total] = await Promise.all([
    queryLeads(user.id, await searchParams),
    db.lead.count({ where: { userId: user.id } }),
  ]);
  const leads = result.leads.map(
    ({
      updatedAt: _updated,
      verifiedAt: _verified,
      discoveredAt: _discovered,
      ...l
    }) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      lastContactAt: l.lastContactAt?.toISOString() || null,
    }),
  );
  return (
    <LeadTable
      {...result}
      leads={leads}
      status={result.status || ""}
      total={total}
    />
  );
}
