// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";


export default {
  fetch: withSupabase({ auth: ["none"] }, async (req, ctx) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 200,
      headers: {"Content-Type": "application/json"}
    })
  }

try {

 console.log('_______________________');

  
  const payload = await req.json();


  const cordic_hello_request_body = {
    "verbVersion": "1.0",
    "virtualDirectory": "Consumer"
  };

// say hello to cordic
    const taurusHello = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?taurushello", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cordic_hello_request_body)
    })

    const taurusResult = await taurusHello?.json();

    if (taurusResult.errorCode) {
      return new Response(JSON.stringify({ error: "Failed to say hello to cordic"}), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })
    };

    const token = taurusResult?.jwt;
    console.log("taurusHello", taurusResult?.jwt)


// booking details
  const full_name = payload.full_name;
  const phone = payload.phone;
  const email = payload.email;
  const vehicleTypes = payload.vehicletypes;
  const booked_for = payload.local_time;
  const pickup = payload.pickup;
  const dropoff = payload.dropoff;
  const via = payload.via;
  const payment = payload.payment;



  let bookBody = { 
      book: false, 
      isoTime: booked_for,
      payment: payment, 
      name: full_name, 
      phone: phone, 
      email: email, 
      pickup: { 
        address: pickup.address,
        postcode: pickup.postcode, 
        latitude: pickup.latitude, 
        longitude: pickup.longitude, 
        usedWhat3Words: pickup.usedWhat3Words
      }, 
      dropoff: { 
        address: dropoff.address,
        postcode: dropoff.postcode, 
        latitude: dropoff.latitude, 
        longitude: dropoff.longitude, 
        usedWhat3Words: dropoff.usedWhat3Words
      }, 
      via: via, 
      vehicleTypes: vehicleTypes, 
      ringback: false, 
      textback: true, 
      verbVersion: 6.0, 
      quotedEtaMins: 0, 
      quotedAvailMins: 0, 
      waitReturn: false
    }

    console.log("Book body: ", bookBody)


  const cordicBooking = await fetch('https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?book', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify(bookBody)
  });

  const cordicBookingResult = await cordicBooking?.json();


  
  console.log("Quoted", cordicBookingResult);
  return new Response(JSON.stringify({ok:true, cordicBookingResult}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  
 } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
 }
})
}