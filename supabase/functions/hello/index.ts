// Supabase Edge Function: hello
//
// This is the "does it even run" function. It takes an optional JSON body
// like { "name": "parker" } and echoes a greeting back. No database, no
// secrets, no Cordic — just proof that you can write, deploy, and invoke
// an edge function end to end.
//
// Edge functions run on Deno (not Node). `Deno.serve` is the built-in HTTP
// server — every request that hits this function's URL lands in this handler.

Deno.serve(async (req) => {
  // Requests might arrive with no body (e.g. a browser GET), so default safely
  // instead of throwing when there's nothing to parse.
  const { name } = await req.json().catch(() => ({ name: "world" }));

  const body = JSON.stringify({
    message: `Hello ${name ?? "world"} — your edge function is live.`,
  });

  return new Response(body, {
    headers: { "Content-Type": "application/json" },
  });
});
