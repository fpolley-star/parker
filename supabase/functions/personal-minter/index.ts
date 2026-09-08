// serverside personal account token refresh


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

  console.log('cid: ', cordic_login_id, 'uid: ', user_id)

if (!user_id || !cordic_login_id) {
    return new Response(JSON.stringify({ error: "Insuffcient payload, cordic_login_id and user_id required"}), {
      status: 400,
      headers: { "Content-Type": "application/json"},
    })
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

    console.log("Secret Fetch:", {cordic_login, cordic_login_error});


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
    const cordic_password = decrypted_password

  // Authenticate to Cordic
    const cordic_hello_request_body = {
      "verbVersion": "1.0",
      "virtualDirectory": "Consumer"
    };
    // Authenticate to Cordic
    const cordic_login_request_body = {
      "phase": 4,
      "verbVersion": "1.1",
      "app": "com.cordic.webbooker",
      "appVersion": "1.0.0",
      "email": cordic_identifier,
      "password": cordic_password
    };


  //Access Cordic
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
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    };

    const helloToken = taurusResult?.jwt


    // Authenticate to Cordic
    const loginCordic = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${helloToken}`
      },
      body: JSON.stringify(cordic_login_request_body)
    });

    const loginResult = await loginCordic?.json();

      if (loginResult.errorCode) {
      return new Response(JSON.stringify({ error: "Failed to authenticate personal cordic"}), {
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    };

    const token = loginResult?.jwt;


    console.log("User login", loginResult);
    return new Response(JSON.stringify({ok: true, "token": token}), {
      status: 200,
      headers: {"Content-Type": "application/json"}
    });

  } catch (err) {    
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
})