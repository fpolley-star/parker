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

**Who arrives, and through which door:**
- **Smart-server users** (email + password already in Cordic) → `onboard`.
- **Legacy web-booker users** (username + password on a payment-method account,
  NOT in the smart server) → `migrate-legacy`. Login input routes on `@`.
- **Genuinely new users** → `sign-up`.
- **Guests** (not logged in) → quote only, via the planned `guest-quote`.

## Architecture (the "robust" path)
- **Backend owns auth and bookings.** The browser never holds a Cordic token or
  password — it only reads/writes its own RLS-guarded Supabase rows.
- **Bookings are async and row-driven:** client inserts a `pending` row → a DB
  **webhook** fires `process-booking` → it calls Cordic and writes the result
  back → client reacts via Realtime. **The row is the source of truth.**
- **Function families:**
  - **Doors / writers** (`onboard`, `sign-up`, `migrate-legacy`,
    `corporate-add`) — validate or create Cordic creds, then create/heal the
    Supabase rows (auth user, profile, account, login, membership, vault secret).
  - **Minters** (`personal-minter`, `corporate-minter`) — take a stored login,
    decrypt its vault secret, authenticate to Cordic, return a fresh session.
  - **Job actions** (`get-quote`, `cancel-job`, `get-job-history`,
    `resolve-job`) — look up the login → mint by `type` → one Cordic call.
- **Cordic passwords live in Supabase Vault** (encryption, not hashing — we
  replay the plaintext). Decrypt ONLY server-side via SECURITY DEFINER RPCs.
  Store the vault secret's UUID on the login row, never the password.
- **Identity for authz always comes from the verified JWT** (`userClaims.id`),
  never the request body. The body is a claim anyone can forge.
  *(Known violation: the minters — see Parked 🔴.)*
- **Wized is the client** → every function it calls follows the
  **200 + `data.ok`** contract (see Patterns).

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
  `jwtquote`, `error_msg` (json), **`for_guest`** bool + **`guest`** jsonb
  (`first_name`,`last_name`,`phone`,`email` — the *passenger* when a logged-in
  user books for someone else; process-booking sends these to Cordic instead of
  the booker's), + Cordic response (`cordic_job_id`, `review`, `base_price`,
  `price`, `priceavailable`). RLS: insert/select own; server writes back.
- **`contacts`** — saved passengers ("guest circle"). `first_name`,
  `last_name`, `title`, `email`, `phone`, `saved`, `added_by` → auth.users
  (NO cascade — keep the data; deleting the author is blocked by design),
  `user_id` → auth.users (set null — optional link to a real user),
  `cordic_login_id` → cordic_logins (not null — workspace scoping).
  RLS: full CRUD on own (`added_by = auth.uid()`).
- **`vehicle_types`** — CMS for the vehicle picker. `identifier` (citext
  unique, matches Cordic), `name`, `icon`, `description`, `luggage`,
  `passengers`, images, `sort_order`, `active`. RLS: **public read**
  (`authenticated, anon`) where `active`. Seeded (idempotent `on conflict`).

## Edge functions
`auth:'none'` in code ⇒ `verify_jwt = false` in `config.toml`, or the gateway 401s.

**Doors (onboarding)**
- **`onboard`** (`auth:none`) — smart-server user. Consumer hello → register
  phase 4 (login) → **migrate** (createUser `email_confirm:true` + profile +
  vault + login + membership) or **heal** (updateUserById + create profile if
  missing + find-or-create login / refresh vault). Still uses 4xx statuses —
  not yet on the 200 contract.
- **`sign-up`** (`auth:none`) ✅ tested — genuinely new user. Consumer hello →
  register **phase 0** → gate `registerError` (≠1 → 200 `ok:false` +
  `errorCode`) → `admin.createUser({email_confirm:false})` → profile (from the
  register response) → **anon-client `auth.resend({type:'signup'})`**
  (log-and-continue) → find-or-create personal login + vault + membership →
  200 `ok:true`. Re-running for an existing auth user 500s at createUser — by
  design, healing is `onboard`'s job.
- **`migrate-legacy`** (`auth:none`) 🔨 — legacy web-booker. Fan-out
  `?credentials` across `CRE0001`/`CASH011`/`DEBI0001` → 0 matches: not found ·
  2+: return account **labels only** (never both profiles — PII) · 1: register
  phase 0 into the smart server. **Known issues for when it resumes:** builds the
  register body from `testLegacyUserResponse` (last loop iteration) instead of
  `matches[0].profile`; `phone` is set to `fullName`; not on the 200 contract
  yet; no Supabase provisioning after register yet; `acc_array` → env.
- **`corporate-add`** (`auth:user`) — validate Cordic corporate creds →
  find-or-create **account** → find-or-create **login** (`account_id`,
  `cordic_user_id`) → membership. Vault heal on an existing login.

**Minters** (plain `Deno.serve`, service role, `verify_jwt=false`, body
`{user_id, cordic_login_id}` → membership check → vault → Cordic)
- **`personal-minter`** — hello → register phase 4 → `{ token }`.
- **`corporate-minter`** — `?credentials` → getuserdetails
  (bookingCapabilities) → paymentdetails (references). **Backfills
  `references` onto cordic_accounts** (log-and-continue), returns
  `{ token, bookingCapabilities, paymentDetails }`. (Dual-auth `withSupabase`
  attempt was reverted — its `secret` door rejects the service_role key.)

**Bookings & jobs**
- **`process-booking`** (webhook, service role) — fires on `bookings` insert →
  look up login → mint by `type` → `?book` (`book:true`, account branch adds
  `references`/`bookingCapabilities`/`byAccUserID`; `for_guest` swaps in the
  passenger) → write back `booked`/`failed`.
- **`get-quote`** (`auth:user`) — same preamble → `?book` with **`book:false`**
  → returns the quote. Partly on the 200 contract.
- **`cancel-job`** · **`get-job-history`** · **`resolve-job`** (`auth:user`) —
  same mint-by-type preamble → `?cancel` · `?jobhistory` · `?resolvestatus`.
- **`guest-quote`** ⬜ planned (decided) — **separate** `auth:none` function,
  `get-quote` stays untouched. Token = the **bare consumer hello jwt** (no
  creds; per the user — confirm on the first live test). Personal-shape body
  with `book:false`, no login lookup, 200 contract. **Quote only** — guests
  sign up to book.

## Cordic cheat-sheet
- **Consumer hello:** `?taurushello` `{verbVersion:"1.0", virtualDirectory:"Consumer"}`
  → `jwt` (no creds). Used as the Bearer for register (phase 0 and 4).
- **Login — `?register` phase 4** `{email, password, app:"com.cordic.webbooker"}`
  → `registerError` **1** ok · **9** unknown email · **10/11** bad password ·
  **13** locked.
- **Create — `?register` phase 0** `{name, phone, email, password}` → returns
  `canonPhone`, `userID`, `userStatus`, `jwt` · `registerError` **1** ok ·
  **3** phone used · **4** email used · **6** invalid phone.
- **Corporate / legacy — `UserMgmt/Consumer?credentials`**
  `{account, identifier, password, appInstance:4, verbVersion:"1.1"}` →
  `errorCode` **0** ok · **11** bad account · **16** bad password · **18**
  unknown user.
- **`?book`** — `book:false` = quote, `book:true` = booking.
- **Legacy payment accounts:** `CRE0001` card · `CASH011` cash · `DEBI0001`
  debit. Same username can exist on several for *different* people.

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
- **supabase-js returns errors, it doesn't throw** — always destructure
  `{ data, error }` and check `error`; a `try/catch` won't see them.
- **Block scope:** a `let` declared inside `if`/`else` dies there — hoist it
  when both branches assign it.
- **Expand → contract migrations:** add + backfill, migrate the code, *then*
  drop the old column. Never drop-and-replace live.
- **Side-effect writes** (references backfill, confirmation email) →
  **log-and-continue**; never let them sink the primary path.
- **Fault-flip:** creds from the user = user's fault; creds from the vault =
  our fault (5xx).
- **Wized contract — 200 + `data.ok`:** Wized drops the body of any non-2xx
  response (shows a generic 500, `data:{}`). So *expected* outcomes the user
  must see (dupe email, bad phone, not found) return **200** with
  `{ ok:false, errorCode, error }`; reserve 5xx for our stack breaking. Branch
  on `data.ok` in Wized.
- **Admin API can't send auth email.** `admin.createUser`/`generateLink` send
  nothing; build a throwaway **anon** client (`SUPABASE_URL` +
  `SUPABASE_ANON_KEY`, auto-injected) and call `auth.resend({type:'signup'})`.
  Uses Supabase's built-in mailer (throttled) until custom SMTP is set.
- **Share code, don't call functions.** Reuse logic via a `_shared/` module,
  not function→function HTTP (extra hop, extra auth failures). Copy first,
  extract once it's green.
- **Two clients:** RLS-scoped `supabase` (who's calling) vs `supabaseAdmin`
  (do the work). A third, anon, only for public auth endpoints.
- **Debugging:** the client only tells you *that* it failed; the function logs
  tell you *where*. Find the last `console.log` that printed.

## Build ladder (✅ done · 🔨 in progress · ⬜ next)
0. ✅ Hello-world edge function.
1. ✅ `bookings` + RLS; insert → webhook → function → row-update loop.
2. ✅ Vault + server-side Cordic login.
3. ✅ Real personal bookings (mint fresh each call; 403-retry deferred to caching).
4. 🔨 Corporate accounts + authz + audit:
   - ✅ onboard (personal migrate/heal, heal creates missing profile)
   - ✅ corporate-add (account → login → membership)
   - ✅ cordic_accounts + backfill + RLS
   - ✅ corporate-minter + references backfill
   - ✅ Rung C: trimmed `bookings`, process-booking looks up the login and
     branches on `type` → corporate bookings
   - ✅ Job actions: quote, cancel, history, resolve
   - ✅ Book for a passenger (`for_guest` + `guest`) + `contacts` + `vehicle_types`
   - ⬜ audit trail (`placed_by` / `on_behalf_of`)
5. 🔨 Doors / onboarding:
   - ✅ sign-up (errors surface in Wized, confirmation email sends)
   - 🔨 migrate-legacy (fan-out done; register + provision to finish)
   - ⬜ guest-quote
   - ⬜ Wire the Wized sign-up + login sequences
6. ⬜ Hardening (see Parked).

## Decisions log
- **Guests quote only**, never book (bookings RLS needs a logged-in `user_id`).
- **guest-quote token = bare consumer hello jwt** (user's call; verify live).
- **"Guest" stays overloaded for now:** `bookings.for_guest`/`guest` = a
  passenger booked by a logged-in user; "guest user" = not-logged-in visitor.

## Open questions (ask before building)
- **Duplicate migration:** `20260921164945_…for_guest` and
  `20260921165319_…for_guest2` contain the **identical** SQL — each adds *both*
  `for_guest` and `guest` (plus an empty `20260921165226_…`). The live table is
  fine (the second would have errored); a fresh replay (`db reset`, new env)
  breaks. Fix: make the duplicate idempotent (`add column if not exists`).

## Parked / Stage-5
- 🔴 **Minters are publicly callable and trust the body.** `verify_jwt=false`,
  identity from body `user_id`, and they return a live Cordic token — breaks
  "identity from JWT" and "browser never holds a Cordic token". Membership
  check is only as strong as the UUIDs' secrecy. Fix: require a shared-secret
  header so only other functions can call them.
- **Rotate the `service_role` key** (was exposed in chat).
- **Public endpoints** (`sign-up`, `onboard`, `migrate-legacy`, `guest-quote`)
  → rate-limit / captcha / origin check before launch. `guest-quote` is the
  most exposed: no creds at all, so anyone can drive Cordic calls through it.
- **Custom SMTP** before launch (built-in mailer is a few emails/hour).
- **`_shared/` extraction:** provision tail (onboard + sign-up), quote body
  (get-quote + guest-quote), mint-by-type preamble (4 copies in the job actions).
- Move `onboard` + `migrate-legacy` onto the 200 + `data.ok` contract.
- Tidy the duplicate `for_guest` migrations.
- `contacts` insert RLS doesn't check membership of `cordic_login_id`.
- **Migrations into git** — `supabase db pull` to version the dashboard schema.
- Drop `cordic_logins.account_number` (contract phase, once all reads use `account_id`).
- Server-side reference validation (answers vs account schema).
- Token caching + `403 → re-login → retry`.
- `processing` state / idempotency (double-booking guard; Cordic `uuid` dedupe).
- Orphan vault-secret cleanup.
- `sync_personal_login` / `sync_account_login` transactional SQL collapse.
- `corporate-add → minter` warm-up.
- Strip debug `console.log`s; env test→prod switch; Cordic URLs/accounts → env.
- Admin / family roles (life360-style invites + controls).
