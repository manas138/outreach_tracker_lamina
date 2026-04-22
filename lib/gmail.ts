import { google, gmail_v1 } from "googleapis";

export function gmailClient(): gmail_v1.Gmail {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN!;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN");
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2 });
}

/**
 * Extracts the header value from a Gmail message.
 */
export function header(msg: gmail_v1.Schema$Message, name: string): string {
  const h = msg.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? "";
}

/**
 * Parses a "To" / "Cc" header into individual email addresses.
 */
export function parseAddresses(raw: string): string[] {
  if (!raw) return [];
  // Split on commas that are not inside quotes, then extract email.
  const parts = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return parts
    .map((p) => {
      const m = p.match(/<([^>]+)>/);
      return (m ? m[1] : p).trim().toLowerCase();
    })
    .filter(Boolean);
}

/**
 * Parses a "From" header to just the email address.
 */
export function parseFromAddress(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}
