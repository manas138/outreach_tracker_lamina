"use client";

import { useMemo, useState } from "react";

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
};

type SortKey = "company" | "primary_recipient" | "sent_at" | "status";

const statusBadge: Record<ThreadRow["status"], string> = {
  Replied:
    "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  Bounced: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  "No response":
    "bg-zinc-700/40 text-zinc-300 border-zinc-600/40"
};

export function ThreadsTable({ rows }: { rows: ThreadRow[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("sent_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        (r.company ?? "").toLowerCase().includes(needle) ||
        (r.primary_recipient ?? "").toLowerCase().includes(needle) ||
        r.subject.toLowerCase().includes(needle) ||
        (r.reply_snippet ?? "").toLowerCase().includes(needle) ||
        (r.detail ?? "").toLowerCase().includes(needle)
      );
    });
    out = [...out].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "sent_at") {
        av = new Date(a.sent_at).getTime();
        bv = new Date(b.sent_at).getTime();
      } else {
        av = ((a[sortKey] as string | null) ?? "").toString().toLowerCase();
        bv = ((b[sortKey] as string | null) ?? "").toString().toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [rows, q, statusFilter, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir(k === "sent_at" ? "desc" : "asc");
    }
  }

  function sortIcon(k: SortKey) {
    if (sortKey !== k) return <span className="opacity-30">↕</span>;
    return sortDir === "asc" ? <span>▲</span> : <span>▼</span>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, recipient, subject, reply…"
          className="flex-1 min-w-[260px] px-3 py-2 rounded-md text-sm bg-zinc-900/60 border border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md text-sm bg-zinc-900/60 border border-zinc-800 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <option>All</option>
          <option>Replied</option>
          <option>Bounced</option>
          <option>No response</option>
        </select>
      </div>

      <div className="text-xs text-zinc-500 mb-2">
        Showing {filtered.length} of {rows.length}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-left">
            <tr>
              <Th onClick={() => toggleSort("company")}>
                Company {sortIcon("company")}
              </Th>
              <Th onClick={() => toggleSort("primary_recipient")}>
                Recipient {sortIcon("primary_recipient")}
              </Th>
              <Th>Subject</Th>
              <Th onClick={() => toggleSort("sent_at")}>
                Sent {sortIcon("sent_at")}
              </Th>
              <Th onClick={() => toggleSort("status")}>
                Status {sortIcon("status")}
              </Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.thread_id}
                className="border-t border-zinc-800/70 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="px-3 py-2 font-medium text-zinc-100">
                  {r.company ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  <div>{r.primary_recipient ?? "—"}</div>
                  {r.recipients.length > 1 && (
                    <div className="text-xs text-zinc-500">
                      +{r.recipients.length - 1} more
                    </div>
                  )}
                </td>
                <td
                  className="px-3 py-2 max-w-[260px] truncate text-zinc-300"
                  title={r.subject}
                >
                  {r.subject}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                  {new Date(r.sent_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadge[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-[420px]">
                  {r.status === "Replied" && r.reply_snippet ? (
                    <div>
                      <div className="text-xs text-emerald-300/80">
                        from {r.reply_from}
                      </div>
                      <div
                        className="truncate text-zinc-300"
                        title={r.reply_snippet}
                      >
                        {r.reply_snippet}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="truncate text-zinc-400"
                      title={r.detail}
                    >
                      {r.detail || "—"}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-zinc-500"
                >
                  No threads match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 font-semibold text-[11px] uppercase tracking-wider text-zinc-400 ${onClick ? "cursor-pointer select-none hover:text-zinc-100" : ""}`}
    >
      {children}
    </th>
  );
}
