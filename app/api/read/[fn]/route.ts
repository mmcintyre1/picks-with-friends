import { auth } from "@/auth";
import { READS, type ReadName } from "@/lib/reads";

export async function POST(request: Request, { params }: { params: Promise<{ fn: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const { fn } = await params;
  if (!Object.hasOwn(READS, fn)) return Response.json({ error: "Unknown lookup." }, { status: 404 });

  const args: unknown = await request.json().catch(() => null);
  if (!Array.isArray(args)) return Response.json({ error: "Bad request." }, { status: 400 });

  const read = READS[fn as ReadName] as (...a: unknown[]) => Promise<unknown>;
  return Response.json(await read(...args));
}
