import { gmailClient, header, parseAddresses, parseFromAddress } from "./gmail";
import { supabaseAdmin } from "./supabase";

export type ThreadRow = {
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

function companyFromEmail(email: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@")[1].toLowerCase();
  const parts = domain.split(".");
  const name = parts[0] || domain;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Classifies a Gmail thread and returns a tracker row.
 */
function classifyThread(
  threadId: string,
  messages: Array<{
    id?: string | null;
    payload?: any;
    internalDate?: string | null;
    snippet?: string | null;
  }>,
  us: string
): ThreadRow | null {
  // First message sent by us
  const outbound = messages.find((m) => {
    const from = parseFromAddress(header(m as any, "From"));
    return from === us;
  });
  if (!outbound) return null;

  const toHeader = header(outbound as any, "To");
  const subject = header(outbound as any, "Subject") || "(no subject)";
  const recipients = parseAddresses(toHeader);
  const primary = recipients[0] ?? null;
  const sentAt = new Date(
    Number(outbound.internalDate ?? Date.now())
  ).toISOString();

  // Look for bounces and replies in the same thread
  const bounces = messages.filter((m) => {
    const from = parseFromAddress(header(m as any, "From"));
    const subj = header(m as any, "Subject").toLowerCase();
    return (
      from.includes("mailer-daemon") ||
      subj.includes("delivery status notification") ||
      subj.includes("undeliverable")
    );
  });

  const replies = messages.filter((m) => {
    const from = parseFromAddress(header(m as any, "From"));
    return from && from !== us && !from.includes("mailer-daemon");
  });

  let status: ThreadRow["status"] = "No response";
  let detail = "";
  let replyFrom: string | null = null;
  let replySnippet: string | null = null;

  if (bounces.length > 0) {
    status = "Bounced";
    // Extract which recipients bounced from the snippet.
    const failedAddrs = new Set<string>();
    for (const b of bounces) {
      const snip = (b.snippet ?? "").toLowerCase();
      for (const addr of recipients) {
        if (snip.includes(addr)) failedAddrs.add(addr);
      }
    }
    detail =
      failedAddrs.size > 0
        ? `Failed: ${Array.from(failedAddrs).join(", ")}`
        : (bounces[0].snippet ?? "").slice(0, 300);
  } else if (replies.length > 0) {
    status = "Replied";
    const first = replies[0];
    replyFrom = parseFromAddress(header(first as any, "From"));
    replySnippet = (first.snippet ?? "").slice(0, 500);
    detail = `Reply from ${replyFrom}`;
  }

  return {
    thread_id: threadId,
    subject,
    recipients,
    primary_recipient: primary,
    company: companyFromEmail(primary),
    sent_at: sentAt,
    status,
    detail,
    reply_from: replyFrom,
    reply_snippet: replySnippet,
    message_count: messages.length
  };
}

export async function scrapeAndUpsert(): Promise<{
  scanned: number;
  upserted: number;
  query: string;
}> {
  const query = process.env.OUTREACH_QUERY || 'in:sent subject:"Shopify x Creative Magic"';
  const us = (process.env.OUTREACH_SENDER || "").toLowerCase();
  const max = Number(process.env.OUTREACH_MAX_THREADS || 500);
  if (!us) throw new Error("OUTREACH_SENDER env var required");

  const gmail = gmailClient();
  const supa = supabaseAdmin();

  let nextPageToken: string | undefined;
  const rows: ThreadRow[] = [];
  let scanned = 0;

  do {
    const list = await gmail.users.threads.list({
      userId: "me",
      q: query,
      maxResults: 100,
      pageToken: nextPageToken
    });
    const threads = list.data.threads ?? [];
    for (const t of threads) {
      if (!t.id) continue;
      const full = await gmail.users.threads.get({
        userId: "me",
        id: t.id,
        format: "metadata",
        metadataHeaders: ["From", "To", "Cc", "Subject", "Date"]
      });
      scanned++;
      const msgs = (full.data.messages ?? []).map((m) => ({
        id: m.id,
        payload: m.payload,
        internalDate: m.internalDate,
        snippet: m.snippet ?? ""
      }));
      const row = classifyThread(t.id, msgs, us);
      if (row) rows.push(row);
      if (scanned >= max) break;
    }
    nextPageToken = list.data.nextPageToken ?? undefined;
  } while (nextPageToken && scanned < max);

  // Upsert in chunks to stay under Postgres statement limits.
  const chunkSize = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((r) => ({
      ...r,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supa.from("threads").upsert(chunk, {
      onConflict: "thread_id"
    });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    upserted += chunk.length;
  }

  // Record last sync time.
  await supa.from("sync_state").upsert({
    key: "last_sync",
    value: {
      finished_at: new Date().toISOString(),
      scanned,
      upserted,
      query
    },
    updated_at: new Date().toISOString()
  });

  return { scanned, upserted, query };
}
