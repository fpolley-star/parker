import {createClient} from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {"Content-Type": "application/json"}
    })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const payload = await req.json()
  const record = payload.record;
  const record_id = record.id;

try {

 console.log('_______________________');
 console.log('_______________________');

  
  const p_user_id = record.user_id;
  const loginID = record.cordic_login_id


// look up cordic_login_id from row, revealing account type for routing
  const { data: qeuryLoginID , error: qeuryLoginID_error } = await supabase
  .from('cordic_logins')
  .select()
  .eq('id', loginID)
  .single();

  if (qeuryLoginID_error) {
    console.log("Query Login Row Failed", qeuryLoginID_error)
    throw new Error( "QL: " + qeuryLoginID_error.message); 
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
      throw new Error( "A_MT: " + accountMint_error.message); 
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
    throw new Error( "P_MT: " + personalMint_error.message); 
  } 
    token = personalMint?.token;
    console.log("Personal Token: ", token);

  }


  // should apply a retry mechanism here if token is not returned, but for now error
  if (!token) {
    console.log("No token returned from minter function");
    throw new Error( "No token returned from minter function"); 
  }
  
 console.log("isoTime: ", record.booked_for)
// booking details
  const full_name = record.full_name;
  const phone = record.phone;
  const email = record.email;
  const notes = record.note;
  const vehicleType = record.vehicletype;
  const status = record.status;
  const created_at = record.created_at;
  const booked_for = record.booked_for;
  const pickup = record.pickup;
  const dropoff = record.dropoff;
  const via = record.via;
  const p_cordic_login_id = record.cordic_login_id;
  const payment = record.payment;
  
  // guest details
  const for_guest = record.for_guest;
  const guestDetails = record.guest || null

  console.log('For Guest: ', for_guest)
  console.log('Guest Detials: ', guestDetails)

let paxFullName;
let paxPhone;
let paxEmail;

  if (for_guest) {
    paxFullName = guestDetails.first_name + ' ' + guestDetails.last_name;
    paxPhone = guestDetails.phone;
    paxEmail = guestDetails.email
  } else {
    paxFullName = full_name;
    paxPhone = phone;
    paxEmail = email
  }

  // Account specific variables
  const references = record?.references;
  const accUserID = qeuryLoginID?.cordic_user_id;


  console.log("accUserID: ", accUserID);

let bookBody

if (bookingType === "account") {
  console.log("bookingCapabilities: ", bookingCapabilities);

  bookBody = { 
      book: true, 
      isoTime: record.booked_for,
      uuid: record_id,
      // account specific
      bookingCapabilities: bookingCapabilities,
      byAccUserID: accUserID,
      references: references,
      //account specific
      payment: payment, 
      name: paxFullName, 
      phone: paxPhone, 
      email: paxEmail, 
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
      isoTime: booked_for,
      uuid: record_id,
      payment: payment, 
      name: paxFullName, 
      phone: paxPhone, 
      email: paxEmail, 
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

  if (!cordicBooking.ok) {
    console.log("Cordic Booking Failed: ", cordicBookingResult.error, cordicBookingResult.errorCode);
    throw new Error("Cordic Booking Failed: " + cordicBookingResult.error );
  }

  console.log("cordic_result: ", cordicBookingResult)

  let booked;
  let booked_error;

  if (cordicBookingResult.errorCode) {
    console.log("FAILED BOOKING: ", cordicBookingResult);
    throw new Error( "Fail Book: " + cordicBookingResult.errorCode + " - " + cordicBookingResult.error); 
    
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

    if (booked_error) {
      console.log("Failed to update successful booking: ", cordicBookingResult.jobID, booked_error);
      // Should retry but log for now
      return new Response(JSON.stringify({ok: false, jobID: cordicBookingResult.jobID}), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("MADE BOOKING: ", cordicBookingResult);
    
  }

  
  console.log("Booking updated");
  return new Response(JSON.stringify({ok: true, jobID: cordicBookingResult.jobID}), {
    headers: { "Content-Type": "application/json" },
  });
  
 } catch (err) {
    let { data: errorUpdate, error: errorUpdate_error } = await supabase
    .from("bookings")
    .update({ 
      status: "failed", 
      error_msg: err.message,
    })
    .eq("id", record.id)
    .select()
    .single();

  if (errorUpdate_error) {
    console.log("Failed to update booking error: ", errorUpdate_error);
  } else {
    console.log("Booking error updated", {errorUpdate, errorUpdate_error});
  }
    
  console.log("Booking catched", "error: ", err);
    return new Response(JSON.stringify({ error: "Caught Error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
 }
})