# Setup — getting edge functions running (MacBook)

This repo is the home for the Supabase backend (edge functions + database
migrations). You author code here / in this branch; you deploy it from your
MacBook with your own Supabase credentials.

Goal of this first pass: **deploy and invoke the `hello` function** so the
whole edge-function workflow is proven before any real complexity (Cordic,
Vault, bookings) touches it.

## 0. One-time: install the Supabase CLI

```bash
brew install supabase/tap/supabase
supabase --version
```

## 1. Get this branch onto your MacBook

```bash
git clone <this repo url> parker      # first time only
cd parker
git checkout claude/cab-booker-token-refresh-77bcvv
git pull
```

## 2. Log in and initialise

```bash
supabase login          # opens the browser, authorises the CLI
supabase init           # creates supabase/config.toml (leaves the hello function in place)
```

> `supabase init` only adds `config.toml`; it won't touch
> `supabase/functions/hello/`.

## 3. Link to your (test) Supabase project

Find your **project ref** in the dashboard URL
(`https://supabase.com/dashboard/project/<PROJECT_REF>`) or under
Project Settings → General.

```bash
supabase link --project-ref <PROJECT_REF>
```

## 4. Deploy the function

```bash
supabase functions deploy hello
```

> No Docker needed for deploy. Docker (Docker Desktop) is only required if you
> later want to run functions locally with `supabase functions serve`.

## 5. Invoke it

Deployed functions require an auth header by default. Grab your **anon key**
from Project Settings → API, then:

```bash
curl -i -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/hello" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name":"parker"}'
```

You should get:

```json
{ "message": "Hello parker — your edge function is live." }
```

Quick smoke test without the auth header: redeploy with
`supabase functions deploy hello --no-verify-jwt`, then curl without the
`Authorization` line. (Turn JWT verification back on before this becomes
anything real.)

## Optional: run it locally (needs Docker Desktop)

```bash
supabase functions serve hello
# then, in another terminal:
curl -i -X POST "http://localhost:54321/functions/v1/hello" \
  -H "Content-Type: application/json" \
  -d '{"name":"local"}'
```

---

Once `hello` returns that JSON, edge functions are demystified and we move to
**Stage 1**: the `bookings` table + the insert → webhook → function → row-update
loop, still with no Cordic and no secrets.
