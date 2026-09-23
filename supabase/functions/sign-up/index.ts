// Sign up flow for new users

import { withSupabase } from 'npm:@supabase/server'
import { createClient } from 'npm:@supabase/supabase-js'  

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
    const date = Date.now().toString();
    const email = payload?.email;
    const phone = payload?.phone;
    const firstName = payload?.first_name;
    const lastName = payload?.last_name;
    const password = payload?.password;

    console.log("___________________");


    if (!email || !password || !phone || !firstName || !lastName) {
      console.log("Incomplete body")
      return new Response(JSON.stringify({ error: "Incomplete body"}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
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
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    };

    const helloToken = taurusResult?.jwt;
    console.log("taurusHello", taurusResult?.jwt)

    
  // Register User
      const cordicRegisterBody = {
        "phase": 0,
        "verbVersion": "1.0",
        "app": "com.cordic.webbooker",
        "appVersion": "1.0.0",
        "name": `${firstName} ${lastName}`,
        "phone": phone,
        "email": email,
        "password": password
      }

    const registerUserCordic = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register", {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": `Bearer ${helloToken}`
      },
      body: JSON.stringify(cordicRegisterBody)
    })

    const registerUserCordicResponse = await registerUserCordic.json();

      if (registerUserCordicResponse.registerError === 3) {
      console.log("Mobile already assigned to an SS account")
      return new Response(JSON.stringify({ ok: false, errorCode: 3, error: "Mobile already assigned to an SS account"}), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (registerUserCordicResponse.registerError === 4) {
      console.log("Email already assigned to an SS account")
      return new Response(JSON.stringify({ ok: false, errorCode: 4, error: "Email already assigned to an SS account"}), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (registerUserCordicResponse.registerError === 6) {
      console.log("Invalid SS Phone number")
      return new Response(JSON.stringify({ ok: false, errorCode: 6, error: "Invalid phone number"}), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (registerUserCordicResponse.registerError !== 1) {
      console.log("Unlogged Error Occurred")
      return new Response(JSON.stringify({ ok: false, errorCode: registerUserCordicResponse.registerError, error: "Unknown Error Occurred"}), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (registerUserCordicResponse.registerError === 1) {
      console.log("Successful Smart Server Sign Up")
    }


    let { data: createUser, error: createUser_error } = await supabaseAdmin.auth.admin
    .createUser({
      email: email,
      password: password,
      email_confirm: false
    })

    console.log('user created: ', createUser);

    if (createUser_error) {
      console.log("FAILED TO CREATE USER")
      return new Response(JSON.stringify({error: "FAILED TO CREATE USER", details: createUser_error }), {
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    };

    let { data: signUpProfile, error: signUpProfile_error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: createUser.user.id, 
        full_name: `${firstName} ${lastName}`, 
        phone: registerUserCordicResponse.canonPhone, 
        cordic_user_id: registerUserCordicResponse.userID, 
        cordic_user_status: registerUserCordicResponse.userStatus,
      })

    if (signUpProfile_error) {
      console.log("FAILED TO CREATE SIGN UP USER PROFILE")
      return new Response(JSON.stringify({error: "FAILED TO CREATE SIGN UP USER PROFILE", details: signUpProfile_error }), {
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    }

      const anon = createClient(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_ANON_KEY')
      )
      const { error: resendError } = await anon.auth.resend({ type: 'signup', email })
      if (resendError) console.log('resend failed (continuing):', resendError)

  // same as onbaordings 

      let { data: queryCLogins, error: queryCLogins_error } = await supabaseAdmin
          .from('cordic_logins')
          .select()
          .eq('username', email)
          .eq('type', 'personal')
          .maybeSingle()

        if (queryCLogins_error) {
            console.log("FAILED TO QUERY USER LOGINS")
            return new Response(JSON.stringify({error: "FAILED TO QUERY USER LOGINS ROW", details: queryCLogins_error }), {
            status: 500,
            headers: {"Content-Type": "application/json"}
          })
        }

       if (queryCLogins) {
        // most cases | match found - > update vault
          let {data: updatePassword , error: updatePassword_error} = await supabaseAdmin.rpc('update_vault_secret', { p_secret_id: queryCLogins.secret_id, p_new_secret: password})

          if (updatePassword_error) {
            console.log("FAILED TO CREATE VAULT SECRET")
            return new Response(JSON.stringify({error: "FAILED TO CREATE VAULT SECRET", details: updatePassword_error }), {
              status: 500,
              headers: {"Content-Type": "application/json"}
            })
          }

          console.log('updated password: -> null ', updatePassword);


        return new Response(JSON.stringify({ ok: true, details: 'user successfully synced' }), {
          status: 200,
          headers: {"Content-Type": "application/json"}
        })

       } else {
        // Edge Cases | No match fofund -> create new
          let {data: newSecretId , error: newSecretId_error} = await supabaseAdmin.rpc('create_vault_secret', {secret: password, name: `${date}-${email}`, description: ''})

          console.log('newSecretId: ', newSecretId);

          if (newSecretId_error) {
            console.log("FAILED TO CREATE VAULT SECRET")
            return new Response(JSON.stringify({error: "FAILED TO CREATE VAULT SECRET", details: newSecretId_error }), {
              status: 500,
              headers: {"Content-Type": "application/json"}
            })
          }

          let { data: cLoginsInsert, error: cLoginsInsert_error } = await supabaseAdmin
                .from('cordic_logins')
                .insert({ account_number: null, username: email, secret_id: newSecretId, type: 'personal'  })
                .select()
                .single()

            console.log('cordic login row: ', cLoginsInsert);

            if (cLoginsInsert_error) {
              console.log("FAILED TO CREATE USER LOGIN ROW")
              return new Response(JSON.stringify({error: "FAILED TO ADD LOGIN ROW", details: cLoginsInsert_error }), {
               status: 500,
               headers: {"Content-Type": "application/json"}
            })
          }

          
      let { data: cMemberships, error: cMemberships_error } = await supabaseAdmin
          .from('cordic_memberships')
          .insert({ cordic_login_id: cLoginsInsert.id , user_id: createUser.user.id })
          .select()
          .single()
      
      console.log('membership row: ', cMemberships);

      if (cMemberships_error) {
        console.log("FAILED TO CREATE MEMBERSHIP ROW")
        return new Response(JSON.stringify({error: "FAILED TO CREATE MEMBERSHIP ROW", details: cMemberships_error }), {
          status: 500,
          headers: {"Content-Type": "application/json"}
        })
      }
    
      return new Response(JSON.stringify({ ok: true, details: 'Email confirmation link sent to your email' }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })

    }


  return new Response(JSON.stringify({ ok: true, Details: 'No Action' }))
    } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}
  }),
}