import {createClient} from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const payload = await req.json();
  // or const {record} = await req.json(); if you prefer destructuring
  const record = payload.record;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const { data, error } = await supabase
  .from("bookings").update({ status: "booked" })
  .eq("id", record.id).select().single();
  
  console.log("Booking updated", {data, error});
  return new Response(JSON.stringify({ok:true}), {
    headers: { "Content-Type": "application/json" },
  });
 })