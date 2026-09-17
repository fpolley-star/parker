import {createClient} from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {"Content-Type": "application/json"}
    })
  }

try {

 console.log('_______________________');
 console.log('_______________________');

  
  const payload = await req.json()
  const record = payload.record;
  const record_id = record.id;
  const p_user_id = record.user_id;
  const loginID = record.cordic_login_id

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

// look up cordic_login_id from row, revealing account type for routing
  const { data: qeuryLoginID , error: qeuryLoginID_error } = await supabase
  .from('cordic_logins')
  .select()
  .eq('id', loginID)
  .single();

  if (qeuryLoginID_error) {
    console.log("Query Login Row Failed")
    return new Response(JSON.stringify({error: 'Query Login Row Failed', error_details: qeuryLoginID_error}), {
      status: 500,
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
    const {data: accountMint, error: accountMint_error } = await supabase.functions.invoke('corporate-minter', {
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

  const {data: personalMint, error: personalMint_error} = await supabase.functions.invoke('personal-minter', {
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
  const full_name = record.full_name;
  const phone = record.phone;
  const email = record.email;
  const notes = record.note;
  const vehicleType = record.vehicletype;
  const status = record.status;
  const created_at = record.created_at;
  const booked_for = record.local_time;
  const pickup = record.pickup;
  const dropoff = record.dropoff;
  const via = record.via;
  const p_cordic_login_id = record.cordic_login_id;
  const payment = record.payment;

  // Account specific variables
  const references = record?.references;
  const accUserID = qeuryLoginID?.cordic_user_id;
  // const bookingCapabilities = accountMint?.bookingCapabilities;


  console.log("accUserID: ", accUserID);
  console.log("bookingCapabilities: ", bookingCapabilities);

let bookBody

if (bookingType === "account") {

  bookBody = { 
      book: true, 
      localTime: booked_for,
      uuid: record_id,
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
      vehicleType: vehicleType, 
      ringback: false, 
      textback: true, 
      verbVersion: 6.0, 
      quotedEtaMins: 0, 
      quotedAvailMins: 0, 
      notes: notes, 
      waitReturn: false
    }

} else {
 
  bookBody = { 
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