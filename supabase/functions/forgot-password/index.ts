// Onboarding flow for migrating and synchronise cordic and supabse accounts

import { withSupabase } from 'npm:@supabase/server'

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {

   try {
    const { supabase, supabaseAdmin, userClaims, jwtClaims, authMode } = ctx
    // supabase       — RLS-scoped to the authenticated user
    // supabaseAdmin  — bypasses RLS (service role)
    // userClaims     — user identity from JWT (id, email, role)
    // jwtClaims      — full JWT claims
    // authMode       — which auth mode matched

    // your business logic goes here

    const payload = await req.json();
    const email = payload?.email
    const submittedOTP = payload?.otp
    const newPass = payload?.password

    console.log("_____________________");
    console.log("Phase : ", payload?.phase)
    console.log("Email: ", email)
    console.log("submittedOTP: ", submittedOTP)
    console.log("New Password : ", newPass)

    // get token
    const cordic_hello_request_body = {
      "verbVersion": "1.0",
      "clientGUID": Deno.env.get("CORDIC_CLIENT_GUID"),
      "password": Deno.env.get("CORDIC_PASSWORD"),
      "appVersion": "1.0"
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
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    };

    const helloToken = taurusResult?.jwt;
    console.log("taurusHello", helloToken)

    // phase 0
    if ( payload.phase === 0 ) {
      // send passowrd reset

      const sendOTP = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${helloToken}`
        },
        body: JSON.stringify({
          "phase": 5,
          "verbVersion": "1.0",
          "app": "com.cordic.webbooker",
          "appVersion": "1.0.0",
          "email": email
        })
      })


      if (!sendOTP.ok) {
        const text = await sendOTP.text()
        console.error("Failed to send otp", sendOTP.status, text)
        return new Response(JSON.stringify({ ok: false, status: sendOTP.status, body: text }), { status: 502, headers: { "Content-Type": "application/json" } })
      }

      const sentOTPResponse = await sendOTP.json()

      if (sentOTPResponse.registerError === 9) {
        console.log("Failed to send reset password")
        return new Response(JSON.stringify({ ok: false, errorCode: 9, error: "User is unknown" }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
      if (sentOTPResponse.registerError !== 1) {
        console.log("Failed to send reset password")
        return new Response(JSON.stringify({ ok: false, errorCode: sentOTPResponse.registerError, error: sentOTPResponse }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
      if (sentOTPResponse.registerError === 1) {
        console.log("Succeded to send reset password")
        return new Response(JSON.stringify({ ok: true, errorCode: 1, details: sentOTPResponse  }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
    }

    // phase 1
    if ( payload.phase === 1 ) {
      // Use otp to sign in with email
      // then use phase 3 to reset password to users updated password
      const verifyOTP = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${helloToken}`
        },
        body: JSON.stringify({
          "phase": 4,
          "verbVersion": "1.0",
          "app": "com.cordic.webbooker",
          "appVersion": "1.0.0",
          "email": email,
          "password": submittedOTP
        })
      })
      if (!verifyOTP.ok) {
        const text = await verifyOTP.text()
        console.error("Failed to send otp", verifyOTP.status, text)
        return new Response(JSON.stringify({ ok: false, status: verifyOTP.status, body: text }), { status: 502, headers: { "Content-Type": "application/json" } })
      }
      const verifyOTPResponse = await verifyOTP.json()
      if (verifyOTPResponse.registerError === 11) {
        console.log("User submitted wrong OTP", verifyOTPResponse)
        return new Response(JSON.stringify({ ok: false, errorCode: 11, error: "User submitted wrong OTP" }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
      if (verifyOTPResponse.registerError === 10) {
        console.log("Max login attempts reached", verifyOTPResponse)
        return new Response(JSON.stringify({ ok: false, errorCode: 10, error: "Max login attempts reached" }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
      if (verifyOTPResponse.registerError === 9) {
        console.log("Unknown user/ invalid email", verifyOTPResponse)
        return new Response(JSON.stringify({ ok: false, errorCode: 9, error: "Unknown user/ invalid email" }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
      if (verifyOTPResponse.registerError !== 1) {
        console.log("Failed to verify OTP")
        return new Response(JSON.stringify({ ok: false, errorCode: verifyOTPResponse.registerError, error: verifyOTPResponse }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }

      if (verifyOTPResponse.registerError === 1) {
        console.log("Succeded to verify OTP");
      }

      console.log("user phone number", '+' + verifyOTPResponse.canonPhone)

      const updatePassword = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${verifyOTPResponse.jwt}`
        },
        body: JSON.stringify({
          "phase": 3,
          "verbVersion": "1.0",
          "app": "com.cordic.webbooker",
          "appVersion": "1.0.0",
          "email": email,
          // "phone": '+' + verifyOTPResponse.canonPhone,
          "password": newPass
        })
      })
      if (!updatePassword.ok) {
        const text = await updatePassword.text()
        console.error("Failed to send otp", updatePassword.status, text)
        return new Response(JSON.stringify({ ok: false, status: updatePassword.status, body: text }), { status: 502, headers: { "Content-Type": "application/json" } })
      }
      const updatePasswordResponse = await updatePassword.json()
      if (updatePasswordResponse.registerError !== 1) {
        console.log("Failed to change Password")
        return new Response(JSON.stringify({ ok: false, errorCode: updatePasswordResponse.registerError, error: updatePasswordResponse }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
      if (updatePasswordResponse.registerError === 1) {
        console.log("Succeeded to update user password")
        return new Response(JSON.stringify({ ok: true, errorCode: updatePasswordResponse.registerError, details: updatePasswordResponse }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })
      }
    }

  return new Response(JSON.stringify({ ok: true, Details: email }))
    } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })}
  }),
}