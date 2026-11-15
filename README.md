# Process – Ivory Events quote builder

Internal tool. `index.html` is the packages page with extra options (generator, venue table/chair covers, pagoda/tent, live-band platform). Tick items, the total updates, then fill in client name, event date, venue and quote # and press **Create quote** to get a client quote page (HTML file, same layout as the sample quotes).

The site lives in `public/` (page, logo and images in `upload-1-images/` and `upload-2-thumbs/`). `wrangler.jsonc` tells Cloudflare Workers to serve that folder as a static site. `apps-script/` and this README are not published.

Editable rates: table covers, chair covers (default ₹16), pagoda/tent (default ₹7,000) and the band platform. Table covers and the platform have no default rate; enter one before creating the quote.

## Google Sheets button

Out of the box, **Create Google Sheet** copies the data and opens a blank sheet; click A1 and paste (formulas included). It also offers a CSV download.

For one-click sheet creation:
1. Go to https://script.google.com, create a project, paste `apps-script/Code.gs`, and set `SECRET` to a private word.
2. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone** → copy the web-app URL.
3. In `public/index.html`, set `SHEETS_WEBAPP_URL` (the URL) and `SHEETS_KEY` (same secret). Redeploy the site.

Sheets are created in the Drive of the account that deployed the script.

## Publishing quotes to clients (one tap)

After **Create quote**, press **Publish quote & get client link**. The page saves the quote to `ivoryeventz-ops/ivory-packages` as `ClientName/YYMMDD.html` (spaces in names become hyphens), and also adds it as a new tab on the client's intro link (see below). The intro link is shown with a **Send on WhatsApp** link and goes live about a minute later, after Cloudflare redeploys. If the same client/quote # already exists, it asks before replacing it.

## Client intro link (one link per client)

Fill **Client name**, **Date of event** and **Venue**, then press **Create client intro link**. This creates `New A/<ClientName>/` in `ivoryeventz-ops/Ivory-Events`, shown at `https://ivory-events.pages.dev/New%20A/<ClientName>/`, with the tabs Intro (intro, reviews, gallery on one scrolling page), Packages and Service Checklist. Send it to a new client on WhatsApp.

When the client replies and you publish a quote for the same name and event date, the quote is saved to `New A/packages/<ClientName>/<quote #>.html` and added to the client's `data.json`. It then appears as a tab named by its creation date, newest first and opened first, on the same link, so the client never needs a second link. The quote # is the creation date (YYMMDD); two quotes on the same day get "(2)" style labels. If the client page does not exist yet, publishing a quote creates it. The same name with a different event date gets its own page (`Name-DDMMYY`).

The page template is `New A/client-shell.html` in Ivory-Events (rebuilt by `New A/generate.py`); the app copies it, so design changes there need no app update.

One-time setup on each phone/computer (the key is saved only in that browser, never in the code or the repo):
1. On GitHub: profile picture → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Name it "Ivory quote publisher", choose an expiry (up to 1 year), **Repository access: Only select repositories → ivory-packages and Ivory-Events**, **Permissions → Contents: Read and write**. (Keys made earlier for ivory-packages only: open the token on GitHub and add Ivory-Events under Repository access.) Generate and copy the key (`github_pat_...`).
3. In the app, open **Publishing key** (bottom of the sidebar), paste the key and press **Save key**.

When the key expires, GitHub rejects it and the page says so; create a new one and save it again. To stop a device publishing, press **Remove key**, or delete the token on GitHub (this stops every device).

"Or send quote to Claude" remains as a fallback and prepares the file and a message for Claude.
