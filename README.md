# Tablée Directe

QR table ordering with Next.js and React, an Express API on Node.js, and a MongoDB storage adapter.

## Run the demo

Use Node.js 22 or later. From this directory, install dependencies and configure the demo.

```sh
npm install
cp .env.example .env
npm run api
```

In a second terminal, run `API_ORIGIN=http://127.0.0.1:4000 npm run dev`, then open [Table 7](http://localhost:3000/?table=7). Open Staff dashboard and select a demo account. Set `PUBLIC_URL` to a reachable LAN or HTTPS address before generating QR codes for phones. For LAN testing, add `-- --hostname 0.0.0.0` to the Next.js command.

1. In the guest menu, add dishes and place an order.
2. Open the staff dashboard in a second window. Find Table 07 and send the order to the kitchen. In Kitchen, mark it ready. Return to Floor and mark it served.
3. In the guest window, call the waiter and settle the bill. To split the bill, enter a partial amount, then settle the remainder in another payment. Leave a review after paying.
4. Resolve the waiter call on the floor dashboard and close the settled table when the party leaves. Closing clears the table's active visit and retains a summary for staff reports, up to the last 100 closed visits per table.

## Roles and dispatch

| Role | Access |
| --- | --- |
| Manager | Reception, floor, kitchen, menu availability, dispatch, and reports |
| Reception | Seat walk-ins, table QR codes, floor service, assign drivers |
| Floor staff | Route table orders to kitchen, serve, resolve requests, settle and close tables |
| Kitchen | Prepare and mark table and delivery orders ready, control availability |
| Driver | See assigned stops, dispatch ready jobs, share a current location, confirm delivery |
| Customer | Sign in to save delivery history, order as a QR guest, or track a delivery with its private link |

For a delivery, add an item and select **Order for delivery**. The guest receives a private tracking link. Kitchen starts and prepares the ticket. Reception assigns a driver. The assigned driver starts and completes delivery. A driver can share a one-time position update in transit, and that position is cleared when delivery completes. The demo uses a sample delivery contact.

Only server-approved roles can mutate tickets, and kitchen responses exclude delivery contact details. Staff and customer accounts use separate signed, HttpOnly cookies. Drivers only see their assigned deliveries. Customer session history only includes deliveries placed while signed in. Guests access their table with the signed QR link and access delivery progress with the private tracking link. Use sample passwords and notes on the public demo.

## Staff workspace

- **Floor** shows table occupancy, outstanding balances, waiter requests, QR codes, and payment recording. Staff can cancel new orders before payment.
- **Kitchen** shows new, cooking, and ready tickets, including guest notes and elapsed time.
- **Menu** lets staff mark dishes sold out and restore availability.
- **Reports** shows closed visits, payments, tips, and ratings by Paris date, with a CSV of closed visits.

The sample menu uses euros. For an existing persistent installation that stored dollar amounts, use a fresh database or migrate the records before upgrading. Update the sample dish details and confirm the allergen information against actual recipes before using the menu in service.

Demo mode uses in-memory storage by default and records simulated payments without taking card details. It resets when Express restarts. Set `MONGODB_URI` while in demo mode to persist the test data.

## Persistent operation

Set `DEMO_MODE=false` and configure `MONGODB_URI`, `MONGODB_DATABASE`, `AUTH_SECRET`, `TABLE_KEY`, and `STAFF_ACCOUNTS_JSON` as server-side environment variables. Generate two distinct secrets of at least 32 characters for session signing and table links. Keep the same auth secret across application instances. Each entry in `STAFF_ACCOUNTS_JSON` maps a lowercase username to its role and a salted password hash, for example `{"alice":{"role":"manager","passwordHash":"salt:hash"}}`. Supported roles are `manager`, `reception`, `floor`, `kitchen`, and `delivery`. Change a staff account’s password hash or role and redeploy to invalidate its existing application sessions.

Generate a password hash locally. This command reads from stdin, so the password stays out of shell arguments and command history.

```sh
node --input-type=module -e "import {hashPassword} from './server/auth.js'; let text=''; for await (const chunk of process.stdin) text+=chunk; process.stdout.write(hashPassword(text.trimEnd())+'\n')"
```

Set `PUBLIC_URL` to the HTTPS guest URL if using a custom domain. When rotating `TABLE_KEY`, regenerate the printed QR codes. Set `SMTP_URL` and `RECEIPT_FROM` to send email receipts.

### Realtime hosting

The local Express server handles WebSocket upgrades at `/api/live`. On Vercel, the Next.js route uses Vercel’s Node.js WebSocket runtime. The socket sends the authorized initial snapshot and subsequent changed records directly. A reconnect loads a new snapshot over the socket. There is no REST polling. Mutations, sign-in, QR generation, and opening order history remain request-driven HTTP operations. Use Atlas or a MongoDB replica set to share change-stream events across processes. Run the demo locally with its standalone API for a shared in-memory socket and API process. Without MongoDB, the hosted demo seeds each function independently and changes made in a separate function may not reach an open socket.

Without demo mode, guests can ask staff to settle the bill. Staff record payment collected separately, including tips and split amounts. This project has no card processor. Rewards are per-visit points and reviews are collected in the floor dashboard for the active visit. Before public deployment, add edge rate limits and replace the shared staff code with individual staff accounts if you need an audit trail.

## Seeded demo and test accounts

The hosted demo starts with sample records when no MongoDB URL is configured. For a persistent demo, set `MONGODB_URI` to a test MongoDB connection, `MONGODB_DATABASE=TableeDirecteDemo`, and `DEMO_MODE=true`, then run:

```sh
npm run seed:demo
```

The command requires a database name ending in `Demo` and inserts only missing fixture records. It preserves edited records and existing accounts on re-runs. Use sample data and passwords only on demo deployments.

| Account | Password | Try this |
| --- | --- | --- |
| `manager` | `2468` | Open **Reports** for a closed visit with sales, tips, and a rating. Open **Menu** and restore Chocolate Layer Cake. |
| `reception` | `3579` | Seat a party at Table 08, open its QR code, then assign the new delivery ending in `0001` to the driver. |
| `floor` | `4680` | Resolve the bill request and record a split payment at Table 04. Mark Table 03 served. |
| `kitchen` | `5791` | Start the new Table 07 ticket, mark the overdue Table 02 ticket ready, and advance a delivery in the Delivery tab. |
| `delivery` | `6802` | Start the assigned ready delivery ending in `0003`. On the delivery already in transit, share a location or mark it delivered. |
| `demo-guest` | `Tablee-Demo-2026!` | Sign in through **Customer account**, open **My orders**, and follow a seeded delivery. Use Table 12 for a fresh QR order, split checkout, and review. |

For live updates, open a guest view and a staff view in separate browser profiles. Try Table 07 and advance its ticket in the kitchen. MongoDB and its change stream provide durable cross-instance updates. The public in-memory demo can reset between requests or deployments.

## Frontend architecture

`app/restaurant.js` coordinates sessions, user actions, and routing between guest and staff screens. Guest browsing, staff operations, and dialogs live in dedicated components. `app/restaurant-api.js` handles HTTP requests made for user actions. `app/live-client.js` owns WebSocket connection and reconnect behavior, and `app/restaurant-state.js` applies server snapshots and record updates. HTTP action responses use the same reducer as socket updates so older record versions cannot overwrite newer ones.
