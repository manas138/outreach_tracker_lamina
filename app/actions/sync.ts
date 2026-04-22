"use server";

import { revalidatePath } from "next/cache";
import { scrapeAndUpsert } from "@/lib/scraper";

export type SyncResult = {
  ok: boolean;
  scanned?: number;
  upserted?: number;
  query?: string;
  error?: string;
  finishedAt?: string;
};

export async function syncNow(): Promise<SyncResult> {
  try {
    const result = await scrapeAndUpsert();
    revalidatePath("/");
    return {
      ok: true,
      scanned: result.scanned,
      upserted: result.upserted,
      query: result.query,
      finishedAt: new Date().toISOString()
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[syncNow] failed", message);
    return { ok: false, error: message };
  }
}
