import { supabaseAnon } from "@/lib/supabase";
import { ThreadsTable } from "@/components/ThreadsTable";

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

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone?: "green" | "red" | "gray" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-700 bg-green-50 border-green-200"
      : tone === "red"
        ? "text-red-700 bg-red-50 border-red-200"
        : tone === "blue"
          ? "text-blue-700 bg-blue-50 border-blue-200"
          : "text-gray-700 bg-white border-gray-200";
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

export default async function Home() {
  const { rows, sync } = await loadData();
  const total = rows.length;
  const replied = rows.filter((r) => r.status === "Replied").length;
  const bounced = rows.filter((r) => r.status === "Bounced").length;
  const noResponse = rows.filter((r) => r.status === "No response").length;
  const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Outreach Tracker
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {sync?.value?.query ? (
                  <>
                    Query:{" "}
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      {sync.value.query}
                    </code>
                  </>
                ) : (
                  "Waiting for first sync..."
                )}
              </p>
            </div>
            <div className="text-xs text-gray-500 text-right">
              {sync?.value?.finished_at ? (
                <>
                  <div>Last sync</div>
                  <div className="font-medium text-gray-700">
                    {new Date(sync.value.finished_at).toLocaleString()}
                  </div>
                  <div className="mt-0.5">
                    Scanned {sync.value.scanned}, upserted{" "}
                    {sync.value.upserted}
                  </div>
                </>
              ) : (
                <div>Never synced</div>
              )}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <Stat label="Total threads" value={total} />
          <Stat label="Replied" value={replied} tone="green" />
          <Stat label="Bounced" value={bounced} tone="red" />
          <Stat label="No response" value={noResponse} tone="gray" />
          <Stat label="Reply rate" value={`${replyRate}%`} tone="blue" />
        </section>

        <ThreadsTable rows={rows} />
      </div>
    </main>
  );
}
