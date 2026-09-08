// serverside cordic corporate login - takes a cordic_login id  ->  decrypts that logins password from 'vault', authenticates to cordic, and returns a fresh session token. the password never leaves the server

// To add in codic userID login


import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const cordic_login_id = payload?.cordic_login_id;
    const user_id = payload?.user_id;

    if (!user_id || !cordic_login_id) {
      return new Response(JSON.stringify({ error: "user_id and cordic_login_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

   // Check if the user has access to this cordic_login
    const {data: membership, error: membership_error} = await supabase
    .from("cordic_memberships")
    .select("*")
    .eq("cordic_login_id", cordic_login_id)
    .eq("user_id", user_id);

    console.log("Membership check", {membership, membership_error});

    if (membership_error || !membership || membership.length === 0) {
      return new Response(JSON.stringify({ error: "User does not have access to this cordic_login" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch the cordic_login & secret_id record
    const { data: cordic_login, error: cordic_login_error } = await supabase
      .from("cordic_logins")
      .select("*")
      .eq("id", cordic_login_id)
      .single();

    if (cordic_login_error || !cordic_login) {
      return new Response(JSON.stringify({ error: "cordic_login not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Decrypt the secret_id to get the password
    const { data: decrypted_password, error: vault_error } = await supabase
      .rpc("get_vault_secret", { secret_id: cordic_login.secret_id });

    if (vault_error || !decrypted_password) {
      return new Response(JSON.stringify({ error: "Failed to retrieve credentials" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cordic_identifier = cordic_login.username;
    const cordic_account_number = cordic_login.account_number;
    const cordic_password = decrypted_password

    // Authenticate to Cordic

    const cordic_login_request_body = {
      "account": cordic_account_number,
      "identifier": cordic_identifier,
      "password": cordic_password,
      "appInstance": 4,
      "verbVersion": "1.1"
    };

    const cordic_login_response = await fetch("https://www.parkercorporate.co.uk/UserMgmt/Consumer?credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cordic_login_request_body),
    });

    const result = await cordic_login_response.json();
    if (result.errorCode === 16) {
      console.log("cordic authentication: invalid password"); 
      return new Response(JSON.stringify({ error: "Invalid Password" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (result.errorCode === 18) {
      console.log("cordic authentication: invalid username"); 
      return new Response(JSON.stringify({ error: "Invalid Username" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (result.errorCode === 11) {
      console.log("cordic authentication: invalid account number"); 
      return new Response(JSON.stringify({ error: "Invalid Account Number" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (result.errorCode) {
      console.log("cordic authentication: invalid credentials"); 
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("cordic authentication successful: ", result); 


    // GET BOOKING CAPABILITES
    const bc_body = {
      accUserID: 0,
      bookingCapabilities: true,
      userGroups: false,
      permissions: false
    }

    const cordic_bc_response = await fetch("https://www.parkercorporate.co.uk/UserMgmt/Consumer?getuserdetails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${result.jwt}`
      },
      body: JSON.stringify(bc_body),
    });

    const bc_result = await cordic_bc_response.json();

    if (bc_result.errorCode) {
      console.log("cordic booking capabilities request failed: ", cordic_bc_response);
      return new Response(JSON.stringify({ error: "Failed to retrieve booking capabilities" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

  
    const bc_token = bc_result?.bookingCapabilities;
    console.log("Booking Capabilities JWT: ", bc_token);



    // GET PAYMENT DETAILS
    const pd_body = { verbVersion: "1.0" }

    const cordic_pd_response = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?paymentdetails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${result.jwt}`
      },
      body: JSON.stringify(pd_body),
    });


    const pd_result = await cordic_pd_response?.json();
    console.log("Payment Details JWT: ", pd_result)

    if (pd_result?.errorCode) {
      console.log("cordic payment details request failed: ", cordic_pd_response);
      return new Response(JSON.stringify({ error: "Failed to retrieve payment details" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    console.log("Payment Details: ", pd_result);


// Return the JWT and booking capabilities to the client
    return new Response(JSON.stringify({ 
      ok: true, 
      token: result.jwt,
      bookingCapabilities: bc_token,
      paymentDetails: pd_result
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
