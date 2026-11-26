# Tablée Directe

QR table ordering with Next.js and React, an Express API on Node.js, and a MongoDB storage adapter.

## Run the demo

Use Node.js 22 or later. From this directory, install dependencies and configure the demo.

```sh
npm install
cp .env.example .env
npm run dev
```

Open [Table 7](http://localhost:3000/?table=7). Use staff code `2468`. Set `PUBLIC_URL` to a reachable LAN or HTTPS address before generating QR codes for phones. For LAN testing, run `npm run dev -- --hostname 0.0.0.0`.

1. In the guest menu, add dishes and place an order.
2. Open the staff dashboard in a second window. Find Table 07 and send the order to the kitchen. In Kitchen, mark it ready. Return to Floor and mark it served.
3. In the guest window, call the waiter and settle the bill. To split the bill, enter a partial amount, then settle the remainder in another payment. Leave a review after paying.
4. Resolve the waiter call on the floor dashboard and close the settled table when the party leaves. Closing clears the table's active visit and retains a summary for staff reports, up to the last 100 closed visits per table.

## Staff workspace

- **Floor** shows table occupancy, outstanding balances, waiter requests, QR codes, and payment recording. Staff can cancel new orders before payment.
- **Kitchen** shows new, cooking, and ready tickets, including guest notes and elapsed time.
- **Menu** lets staff mark dishes sold out and restore availability.
- **Reports** shows closed visits, payments, tips, and ratings by Paris date, with a CSV of closed visits.

The sample menu uses euros. For an existing persistent installation that stored dollar amounts, use a fresh database or migrate the records before upgrading. Update the sample dish details and confirm the allergen information against actual recipes before using the menu in service.

Demo mode uses in-memory storage by default and records simulated payments without taking card details. It resets when Express restarts. Set `MONGODB_URI` while in demo mode to persist the test data.

## Persistent operation

Set `DEMO_MODE=false`, configure `MONGODB_URI`, and choose separate long random secrets for `STAFF_PIN` and `TABLE_KEY`. Use a database separate from your demo data. Set `PUBLIC_URL` to your HTTPS guest URL. After changing `TABLE_KEY`, regenerate the QR codes from the staff dashboard. Configure SMTP and the sender address to enable emailed receipts.

Next.js hosts Express through a Node.js API route on Vercel. Set `MONGODB_URI`, `MONGODB_DATABASE`, `STAFF_PIN`, and `TABLE_KEY` as server-side Vercel environment variables and redeploy. `PUBLIC_URL` is optional on Vercel and defaults to the production site URL. Only enable `DEMO_MODE=true` for a demo. Without MongoDB, demo data lives in the function instance and can disappear or differ across requests.

For a separate local Express process, run `npm run api` and set `API_ORIGIN=http://127.0.0.1:4000` before starting Next.js.

Without demo mode, guests can ask staff to settle the bill. Staff record payment collected separately, including tips and split amounts. This project has no card processor. Rewards are per-visit points and reviews are collected in the floor dashboard for the active visit. Before public deployment, add edge rate limits and replace the shared staff code with individual staff accounts if you need an audit trail.
