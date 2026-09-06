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
- The one existing exception is `supabase/functions/hello/index.ts`, written as
  a reference to read and dissect. From Stage 1 onward the user writes the code.

## What this is
Custom web portal (Webflow + Wized front end, Supabase back end) for a cab
company, layered on top of the **Cordic** dispatch provider. Users log into our
Supabase-auth layer and can act on a **personal** account or switch into
**corporate** accounts. Cordic only issues short-lived API tokens (no refresh
tokens), so the backend must re-authenticate behind the scenes when one expires.

## Architecture chosen (the "robust" path)
- **Backend owns auth and bookings.** The browser never holds a Cordic token or
  password — it only reads/writes its own Supabase rows (RLS-guarded).
- **Bookings are async and row-driven:** client inserts a `pending` row → a
  Supabase **Database Webhook** fires an edge function → the function calls
  Cordic, handles `403 → re-login → retry`, and writes the result back to the
  row → the client reacts via Realtime. The row is the source of truth.
- **Cordic passwords live in Supabase Vault** — encryption, not hashing (we need
  the plaintext back to replay to Cordic). Decrypt ONLY server-side in edge
  functions via the service role. Store the Vault secret's UUID on the account
  row, never the password itself.
- Corporate accounts can be **shared** (e.g. "marketing"), so treat corporate
  credentials as shared-by-default: server-side only, with a per-user
  membership/authz check, and record `placed_by` + `on_behalf_of` on each
  booking for audit.

## Build ladder (each rung independently testable)
0. Hello-world edge function (deploy → invoke). ← current stage
1. `bookings` table + RLS; insert → webhook → function → row-update loop, no Cordic.
2. Vault + server-side Cordic login.
3. Real bookings + token-refresh-retry.
4. Corporate accounts + authz + audit trail.
5. Hardening: idempotency, token caching, stale-password re-prompt, env-based test→prod switch.
