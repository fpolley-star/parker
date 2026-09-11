// Verifying corporate accounts

import { withSupabase } from 'npm:@supabase/server'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {

    try {
    const { supabase, supabaseAdmin, userClaims, jwtClaims, authMode } = ctx
    // supabase       — RLS-scoped to the authenticated user
    // supabaseAdmin  — bypasses RLS (service role)
    // userClaims     — user identity from JWT (id, email, role)
    // jwtClaims      — full JWT claims
    // authMode       — which auth mode matched

    // your business logic goes here
    console.log('_________________________________');
    console.log('_________________________________');
    const payload = await req.json();

    if (!payload.accountNo || !payload.username || !payload.password ) {
      console.log("Insufficient request body"); 
      return new Response(JSON.stringify({ error: "Insufficient request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cordic_login_request_body = {
      "account": payload?.accountNo,
      "identifier": payload?.username,
      "password": payload?.password,
      "appInstance": 4,
      "verbVersion": "1.1"
    };


    // Check this user has provided the right credentials for this account
    const cordic_login_response = await fetch("https://www.parkercorporate.co.uk/UserMgmt/Consumer?credentials", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(cordic_login_request_body)
    });

    const loginResult = await cordic_login_response.json();

    if (loginResult.errorCode === 16) {
      console.log("cordic authentication: invalid password"); 
      return new Response(JSON.stringify({ error: "Invalid Password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (loginResult.errorCode === 18) {
      console.log("cordic authentication: invalid username"); 
      return new Response(JSON.stringify({ error: "Invalid Username" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (loginResult.errorCode === 11) {
      console.log("cordic authentication: invalid account number"); 
      return new Response(JSON.stringify({ error: "Invalid Account Number" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (loginResult.errorCode) {
      console.log("cordic authentication: invalid credentials"); 
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("cordic authentication successful: ", loginResult); 


    // Query cordic_logins table for this 'account_number' + 'username' -> Sees if we have a secret (encrupted password) for this account user

    console.log(payload.accountNo);
    console.log(payload.username);

    const { data: queryData, error: queryData_error } = await supabaseAdmin
    .from('cordic_logins')
    .select()
    .eq("account_number", payload.accountNo)
    .eq("username", payload.username )

    if (queryData_error) {
      console.log("cordic_logins Query Failed")
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: queryData_error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}

    console.log("Query Data: ",queryData.length , queryData)


  let cordic_login_id;

    
    // IF queryData is empty -> brand nnew account 
  if (queryData.length === 0) {
    // store password
    const { data: secretData, error: secretData_error } = await supabaseAdmin.rpc("create_vault_secret", { secret: payload?.password, name: `${Date.now()}-${payload.accountNo}-${payload.username}`, description: ''})


    if (secretData_error ) {
      console.log("failed storing users password: ", secretData_error)
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: secretData_error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}


    // insert the account details and secret id in cordic_logins table
    const { data: insertLogin, error: insertLogin_error } = await supabaseAdmin
    .from('cordic_logins')
    .insert({ account_number: payload?.accountNo, username: payload?.username, secret_id: secretData, type: 'account' })
    .select()
    .single()



   if (insertLogin_error) {
    console.log("failed creating account row")
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: insertLogin_error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}

     cordic_login_id = insertLogin.id;


    // connect the user into the account by establishing a memebrship row with the userrs id and the insertLogin row id

  } else { 
    // FOUND ACCOUNT ROW: update self heal password
    cordic_login_id = queryData[0].id;
    const {data: healPassword, error: healPassword_error} = await supabaseAdmin.rpc("update_vault_secret", { p_secret_id: queryData[0].secret_id, p_new_secret: payload?.password} )

   if (healPassword_error) {
    console.log("failed healing password: ", healPassword_error)
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: healPassword_error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}

    console.log("Password Updated: ")
    
  }

   // IF queryData isnt empty then we found an account
   const {data: insertMembership, error: insertMembership_error} = await supabaseAdmin
    .from('cordic_memberships')
    .insert({cordic_login_id: cordic_login_id, user_id: ctx.userClaims?.id })
    .select()
    .single()
  
    if (insertMembership_error && insertMembership_error.code !== '23505') {
    console.log("failed creating membership row")
    return new Response(JSON.stringify({ error: "server error", details: insertMembership_error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }



      console.log("success")
      return new Response(JSON.stringify({ ok: true, msg: "Account Synced" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}
  }),
}