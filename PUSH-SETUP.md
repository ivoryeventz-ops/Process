# Ivory Hub reminders on iPhone - setup (about 15 minutes)

What you get: every morning at 8:30 AM, one notification on Navin's and Anila's iPhones listing what is due (3 days before, 1 day before, day after a wedding), taken from the same ticks as the Enquiries app. Nothing is sent when nothing is due.

Nothing below changes your live hub until step 4. All the new files are on the branch `push-notifications` in two repos:
- `Process` (the hub): the Worker (`src/worker.js`), the enable bar (`public/index.html`), `public/sw.js`, `wrangler.jsonc`
- `Ivory-Enquiries`: `apps-script/Code.gs` (new "what is due" part)

## 1. Cloudflare (once)
1. Cloudflare dashboard > Storage and databases > KV > Create a namespace, name it `ivory-push`. Copy its ID.
2. Open `wrangler.jsonc` on the `push-notifications` branch in `Process` and replace `PASTE_KV_NAMESPACE_ID_HERE` with that ID (or send me the ID and I will do it).
3. Make up a long password (only you two need to know it). This is the notification key. Keep it handy.
4. Cloudflare > Workers and Pages > `process` > Settings > Variables and secrets > Add > type **Secret**, name `PUSH_KEY`, value = your password.

## 2. Google Apps Script (once)
1. Open the Ivory Enquiry Book > Extensions > Apps Script.
2. Replace `Code.gs` with `apps-script/Code.gs` from the `push-notifications` branch of `Ivory-Enquiries`.
3. Project Settings (gear) > Script properties > Add script property: name `PUSH_KEY`, value = the same password as above.
4. Deploy > Manage deployments > pencil > Version: New version > Deploy. Keep "Who has access" as **Anyone**, otherwise Cloudflare cannot read what is due.

## 3. Quick check before going live
Open this in a browser, with your password in place of `YOURKEY`:
`<your web app /exec link>?push=due&key=YOURKEY`
You should see something like `{"count":3,"title":"Ivory: 3 things to do","body":"..."}` or `{"count":0}`. `Not allowed` means the key does not match.

## 4. Go live
Merge the `push-notifications` branch into `main` in `Process`. Cloudflare redeploys the hub in about a minute.

## 5. On each iPhone (needs iOS 16.4 or newer)
1. Open the hub link in Safari > Share > Add to Home Screen. (If you already installed it, delete the old icon and add it again so it picks up the update.)
2. Open Ivory from the Home Screen icon. A bar appears at the bottom: type the notification key, tap **Turn on**, tap Allow.
3. A "Reminders are on" notification arrives straight away. That confirms it works.
4. To see the bar again later, open the hub with `?notify` at the end of the address.

## Good to know
- Time: 8:30 AM India time. To change it, edit `crons` in `wrangler.jsonc` (it is in UTC; 8:30 AM IST = `0 3 * * *`).
- The wedding timeline task is treated as done when it was ticked, or when a client folder with a matching name word exists in the timeline repo. If GitHub cannot be read that morning, the timeline line is left out instead of guessed.
- Not included yet: "confirmed works with no quote" and unassigned outside vendors. Both need the quote check against ivory-packages, which currently runs in the app screen.
- If a phone stops getting notifications (for example after deleting and re-adding the icon), open the app from the icon and turn it on again.
