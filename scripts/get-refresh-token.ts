/**
 * One-time helper to obtain a Google OAuth refresh token for Gmail read access.
 *
 * Usage:
 *   1. In Google Cloud Console, create an OAuth 2.0 Client ID of type "Desktop app".
 *   2. Copy the client ID and client secret into .env.local:
 *        GOOGLE_CLIENT_ID=...
 *        GOOGLE_CLIENT_SECRET=...
 *   3. Run:  npm run get-token
 *   4. Open the printed URL in a browser, sign in as the Gmail account you want
 *      to scrape, approve the read-only scope, and paste the authorization code
 *      back into the terminal.
 *   5. The refresh token will be printed. Save it in .env.local as:
 *        GOOGLE_REFRESH_TOKEN=...
 */

import { google } from "googleapis";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnv() {
  const candidates = [".env.local", ".env"];
  for (const name of candidates) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
}

async function main() {
  loadEnv();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first."
    );
    process.exit(1);
  }

  // "urn:ietf:wg:oauth:2.0:oob" is deprecated, so use the installed-app flow
  // that returns the code on a localhost redirect. For simplicity we use the
  // manual copy-paste flow with a placeholder redirect the user can set in GCP.
  const redirectUri = "http://localhost";
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes
  });

  console.log("\n1. Make sure your OAuth client has this redirect URI added:");
  console.log(`     ${redirectUri}\n`);
  console.log("2. Open this URL in a browser and approve access:\n");
  console.log(url);
  console.log(
    "\n3. After approving, your browser will redirect to a localhost URL that"
  );
  console.log(
    "   likely shows an error page. Copy the `code=...` value from that URL.\n"
  );

  const rl = readline.createInterface({ input, output });
  const code = (await rl.question("Paste authorization code here: ")).trim();
  rl.close();

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "No refresh token returned. Revoke existing access at https://myaccount.google.com/permissions and try again."
    );
    process.exit(1);
  }

  console.log("\nAdd this to .env.local:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
