import { Card } from "@/components/ui/Card";
import { PROVIDER_ORDER } from "@/lib/research/providerOrder";
import { getProviderStatuses, type ProviderStatus } from "@/lib/research/providerStatus";
import { requireUserAndGroup } from "@/lib/session";

// Always fresh -- the whole point is "how many hits do I have left right now".
export const dynamic = "force-dynamic";

function StatePill({ status }: { status: ProviderStatus }) {
  const [text, cls] =
    status.state === "ok"
      ? ["Working", "bg-win/15 text-win"]
      : status.state === "no_key"
        ? ["No API key", "bg-white/5 text-subtle"]
        : ["Error", "bg-loss/15 text-loss"];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}

function ProviderCard({ status, rank }: { status: ProviderStatus; rank: number }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-sm text-subtle">#{rank}</span>
          <h2 className="font-display text-xl tracking-wide">{status.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {!status.live && (
            <span className="rounded bg-push/15 px-2 py-0.5 text-xs font-medium text-push" title="This server is using offline fixture data for this vendor">
              Mock data
            </span>
          )}
          <StatePill status={status} />
        </div>
      </div>

      {status.message && <p className="text-sm text-loss">{status.message}</p>}

      {status.usage.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {status.usage.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted">{row.label}</dt>
              <dd className="tabular-nums">
                <span className="font-medium">{row.value}</span>
                {row.detail && <span className="text-subtle"> · {row.detail}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {status.reset && <p className="text-xs text-muted">{status.reset}</p>}
      <p className="text-xs text-subtle">{status.limitsNote}</p>
    </Card>
  );
}

export default async function ApisPage() {
  await requireUserAndGroup("/apis");
  const statuses = await getProviderStatuses(PROVIDER_ORDER);
  const names = statuses.map((s) => s.name);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="font-display text-3xl tracking-wide">APIs</h1>
        <p className="text-sm text-muted">Where the odds come from, how much is left, and who wins when they disagree.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Odds providers (NFL)</h2>
        {statuses.map((s, i) => (
          <ProviderCard key={s.source} status={s} rank={i + 1} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Precedence rules</h2>
        <Card className="flex flex-col gap-3 p-4 text-sm">
          <p>
            <span className="font-medium">Order:</span> {names.join(" → ")}.
          </p>
          <div>
            <p className="font-medium">Game list (Browse odds)</p>
            <p className="text-muted">
              Asks {names[0]} first. If it errors or is rate-limited, falls back to {names[1]}, then {names[2]}. The first one that
              answers supplies the list of games. A missing API key does <em>not</em> fall back, so a misconfiguration shows up instead of
              being hidden.
            </p>
          </div>
          <div>
            <p className="font-medium">Game Lines board and a game&apos;s props</p>
            <p className="text-muted">
              All three are asked at once and their lines merged, so one being down just means fewer lines, not an error. When two
              providers report the same book&apos;s same bet, the one earlier in the order wins. The grid shows the first main line per
              side in that merged order, which is why a cell can show DK from one provider and FD from another.
            </p>
          </div>
          <div>
            <p className="font-medium">Caching</p>
            <p className="text-muted">
              {names.filter((n) => n !== "SharpAPI").join(" and ")} results are cached for 15 minutes and shared by everyone, since their
              limits are monthly. SharpAPI is cached about 90 seconds, since its limit is per minute.
            </p>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Free, no key</h2>
        <Card className="p-4 text-sm text-muted">
          <span className="font-medium text-foreground">ESPN</span> supplies Browse schedule (every league), team rosters for player
          props, and the box scores auto-evaluate grades against. No limit to track.
        </Card>
      </section>
    </main>
  );
}
