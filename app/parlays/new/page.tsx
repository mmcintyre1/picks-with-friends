import { requireUserAndGroup } from "@/lib/session";

import { NewParlayForm } from "./NewParlayForm";

export default async function NewParlayPage() {
  await requireUserAndGroup();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl tracking-wide">New parlay</h1>
      <NewParlayForm />
    </main>
  );
}
