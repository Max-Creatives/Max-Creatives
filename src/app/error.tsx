"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-12">
      <h1 className="text-2xl font-semibold">
        We couldn’t load this workspace.
      </h1>
      <p className="my-5 text-zinc-500">
        Check that PostgreSQL is running and database migrations have been
        applied. Your saved leads are unchanged.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
