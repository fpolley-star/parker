// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";


export default {
  fetch: withSupabase({ auth: ["user"] }, async (req, ctx) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 200,
      headers: {"Content-Type": "application/json"}
    })
  }

try {

 console.log('_______________________');

  
  const payload = await req.json();
  const p_user_id = ctx.userClaims?.id;
  const loginID = payload.cordic_login_id


  
// look up cordic_login_id from row, revealing account type for routing
  const { data: qeuryLoginID , error: qeuryLoginID_error } = await ctx.supabase
  .from('cordic_logins')
  .select()
  .eq('id', loginID)
  .single();



  if (qeuryLoginID_error) {
    console.log("Query Login Row Failed")
    return new Response(JSON.stringify({error: 'Query Login Row Failed', error_details: qeuryLoginID_error}), {
      status: 200,
      headers: {"Content-Type": "applicaiton/json"}
    })
  }


  const bookingType = qeuryLoginID.type || null;
  console.log("Query Login: ", qeuryLoginID);
  console.log('user id: ', p_user_id);
  console.log('cordic_login_id: ', loginID);

  let token;
  let bookingCapabilities;

  if (bookingType === "account") {
    const {data: accountMint, error: accountMint_error } = await ctx.supabase.functions.invoke('corporate-minter', {
      body: {user_id: p_user_id , cordic_login_id: loginID}
    })

    if (accountMint_error) {
      //should retry but error for now
      console.log("Unable to mint account token: ", accountMint_error);
      return new Response(JSON.stringify({ error: "Unable to mint account token", details: accountMint_error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log('Account Mint: ', accountMint);
    token = accountMint?.token;
    bookingCapabilities = accountMint?.bookingCapabilities;

  } else {

  const {data: personalMint, error: personalMint_error} = await ctx.supabase.functions.invoke('personal-minter', {
    body: {cordic_login_id: loginID, user_id: p_user_id},
  })

  if (personalMint_error) {
    console.log("Unable to mint personal token: ", personalMint_error);
    return new Response(JSON.stringify({ error: "Unable to mint personal token", details: personalMint_error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } 
    token = personalMint?.token;
    console.log("Personal Token: ", token);

  }
  

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

  // Account specific variables
  const references = payload?.references;
  const accUserID = qeuryLoginID?.cordic_user_id;


  console.log("accUserID: ", accUserID);
  console.log("bookingCapabilities: ", bookingCapabilities);

let bookBody

if (bookingType === "account") {

  bookBody = { 
      book: false, 
      localTime: booked_for,
      // account specific
      bookingCapabilities: bookingCapabilities,
      byAccUserID: accUserID,
      references: references,
      //account specific
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

} else {
 
  bookBody = { 
      book: false, 
      localTime: booked_for,
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
  };

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


/*
  if (cordicBookingResult.errorCode) {

   let { data: booked, error: booked_error } = await supabase
    .from("bookings")
    .update({ 
      status: "failed", 
      error_msg: cordicBookingResult
    })
    .eq("id", record.id)
    .select()
    .single();


    console.log("FAILED BOOKING: ", cordicBookingResult);
    return new Response(JSON.stringify({ok:false, error: cordicBookingResult}), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
     
  } else {
  
    let { data: booked, error: booked_error } = await supabase
    .from("bookings")
    .update({ 
      status: "booked", 
      cordic_job_id: cordicBookingResult.jobID,
      review: cordicBookingResult.review,
      base_price: cordicBookingResult.basePrice,
      price: cordicBookingResult.price,
      priceavailable: cordicBookingResult.priceAvailable,
    })
    .eq("id", record.id)
    .select()
    .single();

    console.log("MADE BOOKING: ", cordicBookingResult);
  
  }
  */
  
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