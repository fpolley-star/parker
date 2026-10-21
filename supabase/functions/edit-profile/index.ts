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
      status: 500,
      headers: {"Content-Type": "application/json"}
    })
  }

  try {

    const payload = await req.json();
    console.log("payload: ", payload)
    const p_user_id = ctx.userClaims?.id;
    const loginID = payload.cordic_login_id;
    const name = payload.name;
    const phone = payload.phone;
    const email = payload.email;
    const password = payload.password;

    if (!loginID || !email || !password) {
      console.log("Insufficient request body");
      throw new Error("Insufficient request body");
    }

    // the access token must bank the current users details, otherwise we need to search for the booking_acc_id in cordic_logins table
    

    // Authenticate to Cordic
    const cordic_hello_request_body = {
      "verbVersion": "1.0",
      "virtualDirectory": "Consumer"
    };

    const cordic_login_request_body = {
      "phase": 4,
      "verbVersion": "1.1",
      "app": "com.cordic.webbooker",
      "appVersion": "1.0.0",
      "email": email,
      "password": password
    };

      const cordic_edit_request_body = {
      "phase": 3,
      "verbVersion": "1.1",
      "app": "com.cordic.webbooker",
      "appVersion": "1.0.0",
      "email": email,
      "password": password,
      "name": name,
      "phone": phone
      
    };

    const taurusHello = await fetch('https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?taurushello', {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(cordic_hello_request_body)
    })

    const taurusHelloResult = await taurusHello.json()
    const taurusJWT = taurusHelloResult.jwt

    console.log("taurusResult: ", taurusHelloResult, "taurusJWT: ", taurusJWT)

    // authenticate user
    const authCordicUser = await fetch('https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${taurusJWT}`,
      },
      body: JSON.stringify(cordic_login_request_body)
    })

    const authCordicUserResult = await authCordicUser.json()

    if (authCordicUserResult.error === "" || authCordicUserResult.error || authCordicUserResult.errorCode || authCordicUserResult.registerError !== 1) {
      console.log("Failed login credentials: ", authCordicUserResult)
      let codeMsg = JSON.stringify(authCordicUserResult)
      if (authCordicUserResult.errorCode === 26) codeMsg = "Invalid Request";
      if (authCordicUserResult.registerError === 11) codeMsg = "Invalid login password";
      if (authCordicUserResult.registerError === 9) codeMsg = "Invalid user details";
      if (authCordicUserResult.registerError === 10) codeMsg = "User edits temporarily locked: " + authCordicUserResult.lockedMins;
      if (authCordicUserResult.registerError === 13) codeMsg = "User edits temporarily locked: " + authCordicUserResult.lockedMins;
      throw new Error("Invalid login credentials: " + "Code: " + (authCordicUserResult.errorCode  || authCordicUserResult.registerError  ) + ' ' + codeMsg)
    }
    console.log("authCordicUserResult: ", authCordicUserResult)

    const userJWT = authCordicUserResult?.jwt


    // update user
    const updateCordicUser = await fetch('https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userJWT}`,
      },
      body: JSON.stringify(cordic_edit_request_body)
    })
    
    const updateCordicUserResult = await updateCordicUser.json()


    if (updateCordicUserResult.error === "" || updateCordicUserResult.error || updateCordicUserResult.errorCode || updateCordicUserResult.registerError !== 1) {
      console.log("Failed login credentials: ", updateCordicUserResult)
      let codeMsg = JSON.stringify(updateCordicUserResult)
      if (updateCordicUserResult.errorCode === 26) codeMsg = "Invalid Request";
      if (updateCordicUserResult.registerError === 11) codeMsg = "Invalid login password";
      if (updateCordicUserResult.registerError === 9) codeMsg = "Invalid user details";
      if (updateCordicUserResult.registerError === 10) codeMsg = "User edits temporarily locked: " + updateCordicUserResult.lockedMins;
      if (updateCordicUserResult.registerError === 13) codeMsg = "User edits temporarily locked: " + updateCordicUserResult.lockedMins;
      throw new Error("Unable to update user: " + "Code: " + (updateCordicUserResult.errorCode  || updateCordicUserResult.registerError  ) + ' ' + codeMsg)
    }
    
    const upEmail = updateCordicUserResult.name;
    const upPhone = updateCordicUserResult.name;
    const upUserId = updateCordicUserResult.userID;
    const upName = updateCordicUserResult.name;

    

    console.log("Successful update: ", updateCordicUserResult)
    return new Response(JSON.stringify({ ok: true, update: updateCordicUserResult, Details: payload }))

  } catch (err) {
    console.log("Caught edit error", "error: ", err);
      return new Response(JSON.stringify({ error: "Caught edit error", details: err.message }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
  }
  })
}