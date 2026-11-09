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

After **Create quote**, press **Publish quote & get client link**. The page saves the quote to `ivoryeventz-ops/ivory-packages` as `ClientName/YYMMDD.html` (spaces in names become hyphens) and shows the client link, e.g. `https://ivory-packages.pages.dev/Rebecca/261103`, with a **Send on WhatsApp** link. The link goes live about a minute later, after Cloudflare redeploys. If the same client/quote # already exists, it asks before replacing it.

One-time setup on each phone/computer (the key is saved only in that browser, never in the code or the repo):
1. On GitHub: profile picture → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Name it "Ivory quote publisher", choose an expiry (up to 1 year), **Repository access: Only select repositories → ivory-packages**, **Permissions → Contents: Read and write**. Generate and copy the key (`github_pat_...`).
3. In the app, open **Publishing key** (bottom of the sidebar), paste the key and press **Save key**.

When the key expires, GitHub rejects it and the page says so; create a new one and save it again. To stop a device publishing, press **Remove key**, or delete the token on GitHub (this stops every device).

"Or send quote to Claude" remains as a fallback and prepares the file and a message for Claude.
