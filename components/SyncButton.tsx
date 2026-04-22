"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncNow, type SyncResult } from "@/app/actions/sync";

export function SyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  const running = isPending;

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await syncNow();
      setResult(r);
      if (r.ok) {
        // Refresh server components so the new data shows up
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className="group inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-400/50 disabled:opacity-60 disabled:cursor-not-allowed px-3.5 py-2 text-sm font-medium text-indigo-200 transition-colors shadow-sm shadow-indigo-500/10"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 ${running ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`}
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
          <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M3 21v-5h5" />
        </svg>
        {running ? "Syncing…" : "Sync now"}
      </button>
      {result && (
        <div
          className={`text-[11px] ${result.ok ? "text-emerald-300" : "text-rose-300"}`}
          role="status"
        >
          {result.ok
            ? `Synced ${result.scanned ?? 0} · upserted ${result.upserted ?? 0}`
            : `Failed: ${result.error ?? "Unknown error"}`}
        </div>
      )}
    </div>
  );
}
