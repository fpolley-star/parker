// Onboarding flow for migrating and synchronise cordic and supabse accounts

import { withSupabase } from 'npm:@supabase/server'

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {

   try {
    const { supabase, supabaseAdmin, userClaims, jwtClaims, authMode } = ctx
    // supabase       — RLS-scoped to the authenticated user
    // supabaseAdmin  — bypasses RLS (service role)
    // userClaims     — user identity from JWT (id, email, role)
    // jwtClaims      — full JWT claims
    // authMode       — which auth mode matched

    // your business logic goes here

    const payload = await req.json();
    const value = payload?.value;
    const password = payload?.password;
    const account = payload?.account
    const date = Date.now().toString();

    console.log("___________________");
    console.log("___________________");
    console.log("___________________");

    if (!value || !password) {
      console.log("value or password missing")
      return new Response(JSON.stringify({ error: "Value or password missing"}), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }


    const acc_array = ['CRE0001', 'CASH011', 'DEBI0001'];



// try credentials against legacy webbooker account types
    let matches = [];
    for (let i = 0; i < acc_array.length; i++) {
      const account = acc_array[i];
      const legacyBody = {
        "account": account,
        "appInstance": 4,
        "identifier": value,
        "password": password,
        "verbVersion": "1.1"
      };

    const testLegacyUser = await fetch("https://www.parkercorporate.co.uk/UserMgmt/Consumer?credentials", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(legacyBody)
    })

    const testLegacyUserResponse = await testLegacyUser?.json();
    
    if (testLegacyUserResponse.errorCode === 0) {
      matches.push({
        account: account, 
        profile: testLegacyUserResponse
      })
    };
    if (testLegacyUserResponse.errorCode === 18) {
      console.log("18 | Unknown user")
    };
    if (testLegacyUserResponse.errorCode === 16) {
      console.log("16 | Wrong password, invalid credentials")
    };
    if (testLegacyUserResponse.errorCode === 11) {
      console.log("11 | Invalid account")
    };
    if (testLegacyUserResponse.errorCode !== 0) {
      console.log("LOGIN ERROR OCCURRED")
    };

    console.log("Legacy test x", testLegacyUserResponse)
  }

  if (matches.length === 0) {
    console.log("No legacy user found")
    return new Response(JSON.stringify({"ok": false, error: "No legacy user"}), {
      status: 404,
      headers: {"Content-Type": "application/json"},
    })
  }
  if (matches.length === 1) {
    console.log("Legacy user found, signing up for smart server: ", testLegacyUserResponse)
  }
  if (matches.length >= 2 ) {
    console.log("Multu user found, ask what account they use")
    return new Response(JSON.stringify({"ok": false, details: matches.map(m => m.account)}), {
      status: 202,
      headers: {"Content-Type": "application/json"},
    })
  }


    const parkerCordicBody = {
      "verbVersion": "1.0",
      "clientGUID" : "38ee69ba-9e63-4286-997f-1a1f664fc6b5",
      "password" : "asdfg145!",
      "appVersion" : "1.0"
    };

// say hello to cordic
    const taurusHello = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?taurushello", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(parkerCordicBody)
    })

    const taurusResult = await taurusHello?.json();

    if (taurusResult.errorCode) {
      return new Response(JSON.stringify({ error: "Failed to say hello to cordic"}), {
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    };

    const helloToken = taurusResult?.jwt;
    console.log("taurusHello", taurusResult?.jwt)

    const registerUserBody = {
      "phase": 0,
      "verbVersion": "1.0",
      "app": "com.cordic.webbooker",
      "appVersion": "1.0.0",
      "name": testLegacyUserResponse.name,
      "phone": testLegacyUserResponse.fullName,
      "email": testLegacyUserResponse.email,
      "password": password
    }


    const registerSmartServer = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${helloToken}`
      },
      body: JSON.stringify(registerUserBody)
    })

    const registerResult = await registerSmartServer?.json(); 

    if (registerResult.registerError === 3) {
      console.log("Mobile already assigned to an SS account")
      return new Response(JSON.stringify({ ok: false, errorCode: 3, error: "Mobile already assigned to an SS account"}), {
        status: 409,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (registerResult.registerError === 4) {
      console.log("Email already assigned to an SS account")
      return new Response(JSON.stringify({ ok: false, errorCode: 4, error: "Email already assigned to an SS account"}), {
        status: 409,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (registerResult.registerError === 6) {
      console.log("Invalid SS Phone number")
      return new Response(JSON.stringify({ ok: false, errorCode: 6, error: "Invalid Phone Number"}), {
        status: 400,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (registerResult.registerError === 1) {
      console.log("Successful Smart Server Sign Up")
    }



  
  return new Response(JSON.stringify({ ok: true, Details: 'No Action' }))
    } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}
  }),
}