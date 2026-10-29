import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-12">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link className="mt-6 inline-block text-emerald-700" href="/">
        Return to your workspace →
      </Link>
    </main>
  );
}
