import { requireUserAndGroup } from "@/lib/session";

import { NewParlayForm } from "./NewParlayForm";

export default async function NewParlayPage() {
  await requireUserAndGroup();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">New parlay</h1>
      <NewParlayForm />
    </main>
  );
}
