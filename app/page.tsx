import { supabaseAnon } from "@/lib/supabase";
import { ThreadsTable } from "@/components/ThreadsTable";
import { SyncButton } from "@/components/SyncButton";

export const revalidate = 60; // Re-render every minute

type ThreadRow = {
  thread_id: string;
  subject: string;
  recipients: string[];
  primary_recipient: string | null;
  company: string | null;
  sent_at: string;
  status: "Replied" | "Bounced" | "No response";
  detail: string;
  reply_from: string | null;
  reply_snippet: string | null;
  message_count: number;
  updated_at?: string;
};

type SyncState = {
  key: string;
  value: {
    finished_at: string;
    scanned: number;
    upserted: number;
    query: string;
  };
  updated_at: string;
};

async function loadData(): Promise<{
  rows: ThreadRow[];
  sync: SyncState | null;
}> {
  const supa = supabaseAnon();
  const [threadsRes, syncRes] = await Promise.all([
    supa
      .from("threads")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(1000),
    supa.from("sync_state").select("*").eq("key", "last_sync").maybeSingle()
  ]);

  if (threadsRes.error) {
    console.error(threadsRes.error);
    return { rows: [], sync: null };
  }
  return {
    rows: (threadsRes.data as ThreadRow[]) ?? [],
    sync: (syncRes.data as SyncState) ?? null
  };
}

function StatCard({
  label,
  value,
  sublabel,
  accent
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: "emerald" | "rose" | "amber" | "indigo" | "zinc";
}) {
  const accentMap: Record<string, { dot: string; value: string; ring: string }> = {
    emerald: {
      dot: "bg-emerald-500",
      value: "text-emerald-300",
      ring: "ring-emerald-500/10"
    },
    rose: {
      dot: "bg-rose-500",
      value: "text-rose-300",
      ring: "ring-rose-500/10"
    },
    amber: {
      dot: "bg-amber-500",
      value: "text-amber-300",
      ring: "ring-amber-500/10"
    },
    indigo: {
      dot: "bg-indigo-500",
      value: "text-indigo-300",
      ring: "ring-indigo-500/10"
    },
    zinc: {
      dot: "bg-zinc-500",
      value: "text-zinc-100",
      ring: "ring-zinc-500/10"
    }
  };
  const a = accent ? accentMap[accent] : accentMap.zinc;
  return (
    <div
      className={`relative rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur px-5 py-4 ring-1 ${a.ring}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${a.value}`}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-xs text-zinc-500">{sublabel}</div>
      )}
    </div>
  );
}

function DeliverabilityBar({
  replied,
  bounced,
  noResponse,
  total
}: {
  replied: number;
  bounced: number;
  noResponse: number;
  total: number;
}) {
  if (total === 0) return null;
  const r = (replied / total) * 100;
  const b = (bounced / total) * 100;
  const n = (noResponse / total) * 100;
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-zinc-200">
          Campaign breakdown
        </div>
        <div className="text-xs text-zinc-500">
          {total.toLocaleString()} threads scanned
        </div>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800/50">
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: `${r}%` }}
          title={`Replied ${replied}`}
        />
        <div
          className="bg-rose-500 transition-all"
          style={{ width: `${b}%` }}
          title={`Bounced ${bounced}`}
        />
        <div
          className="bg-zinc-600 transition-all"
          style={{ width: `${n}%` }}
          title={`No response ${noResponse}`}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Replied{" "}
          <span className="text-zinc-200">{r.toFixed(1)}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> Bounced{" "}
          <span className="text-zinc-200">{b.toFixed(1)}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-600" /> No response{" "}
          <span className="text-zinc-200">{n.toFixed(1)}%</span>
        </span>
      </div>
    </div>
  );
}

function RepliesSection({ replies }: { replies: ThreadRow[] }) {
  if (replies.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur p-5">
        <div className="text-sm font-medium text-zinc-200 mb-1">
          Replies
        </div>
        <div className="text-xs text-zinc-500">No replies yet.</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-zinc-200">
          Replies
          <span className="ml-2 text-xs font-normal text-zinc-500">
            ({replies.length})
          </span>
        </div>
      </div>
      <ul className="space-y-3">
        {replies.map((r) => (
          <li
            key={r.thread_id}
            className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-medium text-zinc-100">
                {r.company ?? "—"}
              </div>
              <div className="text-xs text-zinc-500">
                {new Date(r.sent_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric"
                })}
              </div>
            </div>
            <div className="mt-0.5 text-xs text-emerald-300/90">
              {r.reply_from}
            </div>
            {r.reply_snippet && (
              <div className="mt-2 text-sm text-zinc-300 line-clamp-3">
                {r.reply_snippet}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BouncesSection({ bounces }: { bounces: ThreadRow[] }) {
  // Collect distinct failed addresses
  const failedAddresses = new Set<string>();
  for (const b of bounces) {
    if (b.detail.startsWith("Failed:")) {
      const addrs = b.detail
        .slice("Failed:".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      addrs.forEach((a) => failedAddresses.add(a));
    } else if (b.primary_recipient) {
      failedAddresses.add(b.primary_recipient);
    }
  }
  const addrs = Array.from(failedAddresses).sort();

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-zinc-200">
          Bounced addresses
          <span className="ml-2 text-xs font-normal text-zinc-500">
            ({addrs.length} unique, {bounces.length} threads)
          </span>
        </div>
      </div>
      {addrs.length === 0 ? (
        <div className="text-xs text-zinc-500">No bounces. </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {addrs.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-2 py-0.5 text-xs text-rose-300"
              title={a}
            >
              {a}
            </span>
          ))}
        </div>
      )}
      {addrs.length > 0 && (
        <div className="mt-3 text-xs text-zinc-500">
          Remove these from your list before the next send.
        </div>
      )}
    </div>
  );
}

export default async function Home() {
  const { rows, sync } = await loadData();
  const total = rows.length;
  const replied = rows.filter((r) => r.status === "Replied").length;
  const bounced = rows.filter((r) => r.status === "Bounced").length;
  const noResponse = rows.filter((r) => r.status === "No response").length;
  const replyRate = total > 0 ? (replied / total) * 100 : 0;
  const bounceRate = total > 0 ? (bounced / total) * 100 : 0;
  const delivered = total - bounced;
  const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

  const replies = rows.filter((r) => r.status === "Replied");
  const bounces = rows.filter((r) => r.status === "Bounced");

  const campaign = sync?.value?.query
    ? sync.value.query
        .replace(/in:sent/g, "")
        .replace(/subject:/g, "")
        .replace(/"/g, "")
        .trim()
    : "Outreach campaign";

  return (
    <main className="min-h-screen text-zinc-100">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live — auto-refreshes hourly
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
                {campaign}
              </h1>
              <p className="text-sm text-zinc-500 mt-2">
                Outreach performance across {total.toLocaleString()} threads
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <SyncButton />
              <div className="text-xs text-zinc-500 text-right">
                {sync?.value?.finished_at ? (
                  <>
                    <div className="uppercase tracking-wider">Last sync</div>
                    <div className="font-medium text-zinc-300 mt-0.5">
                      {new Date(sync.value.finished_at).toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-zinc-500">
                      {sync.value.scanned} scanned · {sync.value.upserted} upserted
                    </div>
                  </>
                ) : (
                  <div>Never synced</div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Summary: KPI cards */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total sent" value={total.toLocaleString()} accent="zinc" />
          <StatCard
            label="Replied"
            value={replied.toLocaleString()}
            sublabel={`${replyRate.toFixed(1)}% reply rate`}
            accent="emerald"
          />
          <StatCard
            label="Bounced"
            value={bounced.toLocaleString()}
            sublabel={`${bounceRate.toFixed(1)}% bounce rate`}
            accent="rose"
          />
          <StatCard
            label="No response"
            value={noResponse.toLocaleString()}
            sublabel="awaiting"
            accent="zinc"
          />
          <StatCard
            label="Delivered"
            value={`${deliveryRate.toFixed(0)}%`}
            sublabel={`${delivered} of ${total}`}
            accent="indigo"
          />
        </section>

        {/* Breakdown bar */}
        <section className="mb-6">
          <DeliverabilityBar
            replied={replied}
            bounced={bounced}
            noResponse={noResponse}
            total={total}
          />
        </section>

        {/* Spotlight sections */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <RepliesSection replies={replies} />
          <BouncesSection bounces={bounces} />
        </section>

        {/* Full table */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">All threads</h2>
            <div className="text-xs text-zinc-500">
              Sort and filter the full list
            </div>
          </div>
          <ThreadsTable rows={rows} />
        </section>

        <footer className="mt-12 text-center text-xs text-zinc-600">
          Data synced from Gmail · Stored in Supabase · Refreshed hourly via
          GitHub Actions
        </footer>
      </div>
    </main>
  );
}
