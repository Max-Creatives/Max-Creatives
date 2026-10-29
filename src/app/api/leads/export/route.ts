import { apiError, apiUser } from "@/lib/http";
import { db } from "@/lib/db";
import { csvCell } from "@/lib/csv";
export async function GET() {
  try {
    const user = await apiUser();
    const leads = await db.lead.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50000,
    });
    const columns = [
      "Phone number",
      "Business name",
      "Website",
      "Email address",
      "Industry",
      "Country",
      "State",
      "Lead source",
      "Source URL",
      "Research status",
      "Outreach status",
      "Last contact date",
      "Notes",
    ];
    const csv = [
      columns.map(csvCell).join(","),
      ...leads.map((l) =>
        [
          l.phone,
          l.businessName,
          l.website,
          l.email,
          l.industry,
          l.country,
          l.state,
          l.source,
          l.sourceUrl,
          l.researchStatus,
          l.outreachStatus,
          l.lastContactAt?.toISOString().slice(0, 10),
          l.notes,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="max-outreach-leads.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
