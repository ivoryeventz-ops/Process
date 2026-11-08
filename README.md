# Process – Ivory Events quote builder

Internal tool. `index.html` is the packages page with extra options (generator, venue table/chair covers, pagoda/tent, live-band platform). Tick items, the total updates, then fill in client name, event date, venue and quote # and press **Create quote** to get a client quote page (HTML file, same layout as the sample quotes).

Host it as a static site (e.g. Cloudflare Pages) from the repo root. Images are in `upload-1-images/` and `upload-2-thumbs/`.

Editable rates: table covers, chair covers (default ₹16), pagoda/tent (default ₹7,000) and the band platform. Table covers and the platform have no default rate; enter one before creating the quote.

## Google Sheets button

Out of the box, **Create Google Sheet** copies the data and opens a blank sheet; click A1 and paste (formulas included). It also offers a CSV download.

For one-click sheet creation:
1. Go to https://script.google.com, create a project, paste `apps-script/Code.gs`, and set `SECRET` to a private word.
2. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone** → copy the web-app URL.
3. In `index.html`, set `SHEETS_WEBAPP_URL` (the URL) and `SHEETS_KEY` (same secret). Redeploy the site.

Sheets are created in the Drive of the account that deployed the script.
