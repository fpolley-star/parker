import {createClient} from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {"Content-Type": "application/json"}
    })
  }

try {
  const payload = await req.json()
  const record = payload.record
  const record_id = record.id
  const p_user_id = record.user_id
  const full_name = record.full_name
  const phone = record.phone
  const email = record.email
  const notes = record.note
  const vehicleType = record.vehicletype
  const status = record.status
  const created_at = record.created_at
  const booked_for = record.local_time
  const pickup = record.pickup
  const dropoff = record.dropoff
  const p_cordic_login_id = record.cordic_login_id
  const payment = record.payment

  // Account specific variables


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  console.log("___________________");
  console.log("pickup: ", pickup);
  console.log("pickup address: ", pickup.address);
  console.log("cordic_login_id: ", record.cordic_login_id);


  const {data: personalMint, error: personalMint_error} = await supabase.functions.invoke('personal-minter', {
    body: {cordic_login_id: p_cordic_login_id, user_id: p_user_id},
  })

  if (personalMint_error) {
    consol.log("Unable to mint personal token: ", personalMint_error);
    return new Response(JSON.stringify({ error: "Unable to mint token", details: err.personalMint_error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });

  } 

  const personalToken = await personalMint?.token

  console.log("Personal Token: ", personalToken)
 
  const bookBody = { 
      book: true, 
      localTime: booked_for,
      uuid: record_id,
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
      via: [], 
      vehicleType: vehicleType, 
      ringback: false, 
      textback: true, 
      verbVersion: 6.0, 
      quotedEtaMins: 0, 
      quotedAvailMins: 0, 
      notes: notes, 
      waitReturn: false
    };

    console.log("Book body: ", bookBody)


  const cordicBooking = await fetch('https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?book', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${personalToken}` 
    },
    body: JSON.stringify(bookBody)
  });

  const cordicBookingResult = await cordicBooking?.json();

  let booked;
  let booked_error;

  if (cordicBookingResult.errorCode) {

    let { data: booked, error: booked_error } = await supabase
    .from("bookings")
    .update({ 
      status: "failed", 
    })
    .eq("id", record.id)
    .select()
    .single();

    console.log("FAILED BOOKING: ", booked_error);
     
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
      cordic_user_id: cordicBookingResult.userID
    })
    .eq("id", record.id)
    .select()
    .single();

    console.log("MADE BOOKING: ", cordicBookingResult);
    
  }

  
  console.log("Booking updated", { booked, booked_error});
  return new Response(JSON.stringify({ok:true}), {
    headers: { "Content-Type": "application/json" },
  });
  
 } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
 }
})