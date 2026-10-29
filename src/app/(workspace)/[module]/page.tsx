import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LockKeyhole,
  Sparkles,
  ScanSearch,
  MailSearch,
  Send,
  Inbox,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageUser } from "@/lib/auth";
const modules = {
  research: {
    title: "Research Agent",
    phase: 2,
    icon: ScanSearch,
    description: "Turn a phone number into an evidence-backed business match.",
    features: [
      "Permitted public-source research",
      "Source URLs, timestamps & confidence scores",
      "Manual review for ambiguous matches",
    ],
    needs:
      "An authorized search or business-data provider and permitted source access.",
  },
  discovery: {
    title: "Email Discovery",
    phase: 2,
    icon: MailSearch,
    description:
      "Find professional contact details with a clear trail of evidence.",
    features: [
      "Official website and contact-page research",
      "Public email discovery with source attribution",
      "Contact eligibility review before outreach",
    ],
    needs: "Verified business matches and permitted website access.",
  },
  pitches: {
    title: "AI Pitch Generator",
    phase: 3,
    icon: Sparkles,
    description: "Bring a relevant creative idea to every first conversation.",
    features: [
      "Personalized subjects, pitches & video concepts",
      "A free storyboard offer and follow-up draft",
      "An editable human approval queue",
    ],
    needs:
      "An OpenAI API key with separate API billing, or a reachable local model. A ChatGPT subscription does not include API usage.",
  },
  campaigns: {
    title: "Campaigns",
    phase: 4,
    icon: Send,
    description: "Outreach that moves at your pace, with you in control.",
    features: [
      "Individual message review and approval",
      "Suppression, identity & opt-out checks",
      "Provider-confirmed delivery records",
    ],
    needs:
      "Gmail OAuth, a valid sender postal address, opt-out handling, and a compliance review.",
  },
  inbox: {
    title: "Gmail Inbox",
    phase: 4,
    icon: Inbox,
    description: "Keep client conversations and next steps together.",
    features: [
      "Secure Gmail OAuth connection",
      "Reply retrieval and classification",
      "Prompt unsubscribe suppression",
    ],
    needs:
      "A Google Cloud OAuth client and authorized Gmail account. Google verification may be required.",
  },
  clients: {
    title: "Interested Clients",
    phase: 5,
    icon: HeartHandshake,
    description: "Give every promising conversation the attention it deserves.",
    features: [
      "Positive-response and storyboard tracking",
      "Follow-up reminders",
      "Deal stages and revenue reporting",
    ],
    needs: "Reply tracking and campaign records from the preceding phases.",
  },
};
export default async function Module({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  await pageUser();
  const { module } = await params;
  const m = modules[module as keyof typeof modules];
  if (!m) notFound();
  return (
    <>
      <span className="eyebrow text-emerald-700">THE ROAD AHEAD</span>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
        {m.title}
      </h1>
      <p className="mt-2 text-xs text-zinc-500">{m.description}</p>
      <section className="panel mx-auto mt-10 max-w-2xl p-8 sm:p-12">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <m.icon size={28} strokeWidth={1.5} />
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] text-amber-800">
          Planned for Phase {m.phase} · Not enabled
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">
          A thoughtful next step.
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-500">
          Your lead workspace is the foundation. This module will be implemented
          and tested in a later development phase.
        </p>
        <ul className="my-7 space-y-4">
          {m.features.map((f) => (
            <li
              key={f}
              className="flex items-center gap-3 text-xs text-zinc-500"
            >
              <Circle size={14} className="text-zinc-300" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mb-7 flex gap-2 rounded-lg bg-zinc-50 p-4 text-xs leading-6 text-zinc-500">
          <LockKeyhole size={16} className="mt-1 shrink-0" />
          <span>
            <strong className="block font-medium text-zinc-700">
              Before this can work
            </strong>
            {m.needs}
          </span>
        </div>
        <Button asChild>
          <Link href="/leads">
            Organize your leads
            <ArrowRight size={14} />
          </Link>
        </Button>
      </section>
    </>
  );
}
