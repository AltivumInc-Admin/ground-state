# Signal Issue Publish-to-Rebuild Webhook

## What it does

When an `issue` document is published in Sanity, a webhook POSTs to an Amplify incoming build webhook, triggering an Amplify rebuild of the `main` branch. The rebuild runs the build's `fetch-issues.mjs` → prerender pipeline, regenerating the static `/signal` archive from the published Sanity documents.

**Flow:** Publish issue in Sanity → webhook fires → Amplify build starts → `fetch-issues.mjs` queries for published issues → prerender generates archive HTML → site re-deploys with new archive.

## Setup (Two endpoints)

### 1. Amplify Incoming Build Webhook

In the Amplify console for app `d2c0upa00yly4w`:
1. Navigate to **App settings** → **Build settings** → **Incoming webhooks**
2. Click **Create webhook**
3. Name: `sanity-issue-publish`
4. Branch: `main`
5. Copy the generated URL (form `https://webhooks.amplify.<region>.amazonaws.com/prod/webhooks?id=...&token=...&operation=startbuild`)

**IMPORTANT:** This URL is a secret. Treat it as a credential (like an API key) — do not commit it to the repo, do not paste it in logs or chat. Pass it to Sanity only as the webhook target URL.

### 2. Sanity Webhook

In Sanity Manage → **API** → **Webhooks** → **Create webhook**:
- **Name:** `Amplify rebuild on issue publish`
- **URL:** Paste the Amplify incoming webhook URL from Step 1
- **Dataset:** `production`
- **Trigger on:** Create, Update, Delete
- **Filter:** `_type == "issue"`
- **HTTP method:** POST
- **Projection:** Leave default (Amplify ignores the body)

Test the webhook in Sanity to confirm it accepts POST requests (Sanity shows a 2xx response for a successful trigger test).

## How the filter works

**Only published issue documents trigger the rebuild.** Draft autosaves do not fire the webhook — only the Publish action (which mutates the published document) triggers it. The filter `_type == "issue"` means the webhook only fires for documents of type `issue`, ignoring all other content types.

If you delete a published issue, the webhook also fires (Delete trigger), and the rebuild will re-fetch the remaining published issues.

## Manual rebuild fallback

If a rebuild does not start within ~1 minute of publishing, or if you need to force a rebuild:

1. Go to Amplify console → App `d2c0upa00yly4w` → **Hosting → Deployments**
2. Find the latest commit for `main`
3. Click **Redeploy this version**

This re-runs the full build pipeline without requiring a new commit.

## Configuration notes

- **The Amplify webhook URL and Sanity webhook ID live only in the consoles**, not in the repo. There are no webhook URLs, IDs, or tokens in `package.json`, `.env`, or `amplify.yml` — they are managed externally.
- The `fetch-issues.mjs` script (run during the build) queries the Sanity `production` dataset for all published issue documents. It does not read webhook configuration.
- If the Amplify URL changes (e.g., during a migration), update it in the Sanity webhook settings only; there is no repo update needed.
