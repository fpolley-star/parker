# Parker — working agreement & project notes

## How to work with the user (IMPORTANT — apply every session)
The user is building this project to **learn the principles and run it
independently long term**. Being dependent on AI is an explicit non-goal.
Therefore:
- **Teach, don't take over.** Do NOT write full implementation files for them.
  The user writes the code; you explain the principle first, then review what
  they wrote, correct it, and explain the reasoning.
- **Every step is a learning experience.** Go thoroughly, in small increments,
  and check understanding before moving on.
- **TypeScript is new to the user** (basic JavaScript is fine). Introduce and
  explain TS/Deno concepts as they arise — types, interfaces, async/await,
  runtime differences — never assume them.
- Favour the "why" and the mental model over just the "what". Prefer nudging
  questions and small guided tasks over finished answers.
- **Recalibration:** raw SQL/API *syntax* that keeps tripping (statement order,
  `.eq('col', val)` arg form, reserved words) may be shown directly — it's
  mechanical, not the learning. Logic, JS, and architecture stay with the user.
- **Reply format:** concise and visually segmented — short bold headers, key
  terms bolded, a clear **"your move"** with numbered steps. `>` lines for
  scannable facts, prose for theory. No walls of text.
- The one existing exception is `supabase/functions/hello/index.ts`, a reference
  to read and dissect. From Stage 1 onward the user writes the code.

## What this is
Custom web portal (Webflow + Wized front end, Supabase back end) for a cab
company, layered on the **Cordic** dispatch provider. Users log into our
Supabase-auth layer and act on a **personal** account or switch into **corporate**
accounts. Cordic issues only short-lived tokens (no refresh), so the backend
re-authenticates behind the scenes (currently: mint fresh each time).

## Architecture (the "robust" path)
- **Backend owns auth and bookings.** The browser never holds a Cordic token or
  password — it only reads/writes its own RLS-guarded Supabase rows.
- **Bookings are async and row-driven:** client inserts a `pending` row → a DB
  **webhook** fires `process-booking` → it calls Cordic and writes the result
  back → client reacts via Realtime. **The row is the source of truth.**
- **Two function families:**
  - **Writers** (`onboard`, `corporate-add`) — validate Cordic creds, then
    create/heal the Supabase rows (account, login, membership, vault secret).
  - **Minters** (`personal-minter`, `corporate-minter`) — take a stored login,
    decrypt its vault secret, authenticate to Cordic, return a fresh session.
- **Cordic passwords live in Supabase Vault** (encryption, not hashing — we
  replay the plaintext). Decrypt ONLY server-side via SECURITY DEFINER RPCs.
  Store the vault secret's UUID on the login row, never the password.
- **Identity for authz always comes from the verified JWT** (`userClaims.id`),
  never the request body. The body is a claim anyone can forge.

## Data model
- **`profiles`** — 1:1 with `auth.users`. `id` (PK = auth uid), `full_name`,
  `phone`, `cordic_user_id`, `cordic_user_status`. RLS: select/update own.
- **`cordic_accounts`** — a corporate account (the org). `id`, `account_number`
  (citext unique), `display_name`, `references` jsonb (booking-form schema,
  backfilled by the minter on every mint). RLS: read if you're a member
  (2-hop: logins → memberships → you); writes server-only.
- **`cordic_logins`** — a credential/seat. `id`, `username` (citext), `secret_id`
  (vault uuid), `type` (`personal`|`account`), `account_id` → cordic_accounts
  (null for personal), `cordic_user_id`. Partial unique index: one `personal`
  login per username. RLS: read logins you're a member of; writes server-only.
  *(`account_number` still present — legacy, drop in the contract phase.)*
- **`cordic_memberships`** — M:N junction `(cordic_login_id, user_id)`, cascade
  FKs. RLS: select own; membership is server-granted.
- **`bookings`** — the state machine. `user_id`, `status`
  (`pending`|`booked`|`failed`), `cordic_login_id`, ride fields
  (`pickup`/`dropoff` jsonb, `booked_for`, `local_time`, `vehicletype`,
  `payment`, `note`, `via`), `references` (the user's filled answers),
  `jwtquote`, + Cordic response (`cordic_job_id`, `review`, `base_price`,
  `price`, `priceavailable`). RLS: insert/select own; server writes back.

## Edge functions
- **`onboard`** (`auth:none`) — Family A personal. Validate Cordic personal creds
  → **migrate** (createUser + profile + vault + login + membership) or **heal**
  (updateUserById + refresh vault). Find-or-create the personal login.
- **`corporate-add`** (`auth:user`) — validate Cordic corporate creds →
  find-or-create **account** → find-or-create **login** (`account_id`,
  `cordic_user_id`) → membership. Vault heal on an existing login.
- **`personal-minter`** — mint a fresh personal token (2-leg taurushello →
  register).
- **`corporate-minter`** (`auth:['user','secret']`) — identity from JWT on the
  user door, body on the secret door. creds → getuserdetails (bookingCapabilities)
  → paymentdetails (references). **Backfills `references` onto cordic_accounts**
  (log-and-continue), returns `{ token, bookingCapabilities, paymentDetails }`.
- **`process-booking`** (webhook, service role) — fires on `bookings` insert →
  mint token → book with Cordic → write result back (`booked`/`failed`).

## Vault RPCs (SECURITY DEFINER, `search_path=''`, revoked from anon/authenticated)
`create_vault_secret(secret,name,description)→uuid` ·
`update_vault_secret(p_secret_id,p_new_secret)→void` ·
`get_vault_secret(secret_id)→text` · `get_user_id_by_email(p_email)→uuid`

## Patterns/conventions learned (reuse these)
- **Find-or-create**, not blind insert. `upsert` can't target a partial index.
- **Vault secret names are labels** → timestamp them; the real pointer is
  `secret_id` on the login row. Never look a secret up by name.
- **`.maybeSingle()` → object|null** (test `!x`); **bare `.select()` → array**
  (test `.length`).
- **Expand → contract migrations:** add + backfill, migrate the code, *then*
  drop the old column. Never drop-and-replace live.
- **Side-effect writes** (e.g. references backfill) → **log-and-continue**;
  never let them sink the primary path.
- **Fault-flip:** creds from the user = 4xx; creds from the vault = 5xx.
- **Two clients:** RLS-scoped `supabase` (who's calling) vs `supabaseAdmin`
  (do the work).

## Build ladder (✅ done · 🔨 in progress · ⬜ next)
0. ✅ Hello-world edge function.
1. ✅ `bookings` + RLS; insert → webhook → function → row-update loop.
2. ✅ Vault + server-side Cordic login.
3. ✅ Real personal bookings (mint fresh each call; 403-retry deferred to caching).
4. 🔨 Corporate accounts + authz + audit:
   - ✅ onboard (personal migrate/heal)
   - ✅ corporate-add (account → login → membership)
   - ✅ cordic_accounts + backfill + RLS
   - ✅ corporate-minter: dual-auth + references backfill
   - ⬜ **Rung C:** trim `bookings`, hydrate-join, branch on `type` → corporate bookings
   - ⬜ audit trail (`placed_by` / `on_behalf_of`)
5. ⬜ Hardening (see Parked).

## Parked / Stage-5
- **Rotate the `service_role` key** (was exposed in chat).
- **Migrations into git** — `supabase db pull` to version the dashboard schema.
- Drop `cordic_logins.account_number` (contract phase, once all reads use `account_id`).
- Server-side reference validation (answers vs account schema).
- Token caching + `403 → re-login → retry`.
- `processing` state / idempotency (double-booking guard; Cordic `uuid` dedupe).
- Orphan vault-secret cleanup.
- `sync_personal_login` / `sync_account_login` transactional SQL collapse.
- `corporate-add → minter` warm-up (path B, needs the secret door).
- Strip debug `console.log`s; env test→prod switch.
- Admin / family roles (life360-style invites + controls).