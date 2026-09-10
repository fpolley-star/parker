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
    const email = payload?.email;
    const password = payload?.password;
    const date = Date.now().toString();

    console.log("___________________");
    console.log("___________________");
    console.log("___________________");

    if (!email || !password) {
      console.log("Email or password missing")
      return new Response(JSON.stringify({ error: "Email or password missing"}), {
        status: 400,
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


// try credentials against cordic
    const cordic_login_request_body = {
      "phase": 4,
      "verbVersion": "1.1",
      "app": "com.cordic.webbooker",
      "appVersion": "1.0.0",
      "email": email,
      "password": password
    };

    const loginToCordic = await fetch("https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?register", {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": `Bearer ${helloToken}`
      },
      body: JSON.stringify(cordic_login_request_body)
    })

    const cLoginResponse = await loginToCordic?.json()

    if (cLoginResponse.registerError === 9) {
      console.log("9 | Should sign up | User doesnt exist")
      return new Response(JSON.stringify({ error: "Unknown User, should sign up", details: cLoginResponse }), {
        status: 404,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (cLoginResponse.registerError === 10) {
      console.log("10 | Max Password Attempts | User Exists")
      return new Response(JSON.stringify({ error: "Invalid Login Password | User Exists", details: cLoginResponse }), {
        status: 401,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (cLoginResponse.registerError === 11) {
      console.log("11 | Invalid Login Password | User Exists")
      return new Response(JSON.stringify({ error: "Invalid Login Password | User Exists", details: cLoginResponse }), {
        status: 401,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (cLoginResponse.registerError === 13) {
      console.log("13 | Locked for | User exist")
      return new Response(JSON.stringify({ error: "Locked for | User doesnt exist", details: cLoginResponse }), {
        status: 423,
        headers: {"Content-Type": "application/json"}
      })
    }
    if (cLoginResponse.registerError !== 1) {
      console.log("LOGIN ERROR OCCURRED")
      return new Response(JSON.stringify({ error: "LOGIN ERROR OCCURRED", details: cLoginResponse }), {
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    }

    console.log("Cordic Login", cLoginResponse)


    const {data: foundUser, error: foundUser_error} = await supabaseAdmin.rpc('get_user_id_by_email', {p_email: email})

    if (foundUser_error) {
      console.log("FAILED GET_USER_BY_ID")
      return new Response(JSON.stringify({ error: "UNKNOWN ERROR OCCURRED", details: foundUser_error }), {
        status: 500,
        headers: {"Content-Type": "application/json"}
      })
    };

    console.log("Cordic Email", cLoginResponse?.email)
    console.log("Found User", foundUser)





    if (foundUser) {
      let cLogins
      // heal -> update password auth -> update personal vault secret -> return ok

      // use the email and type personal to ot query cordic logins
      // if we find a match // take that secret id // update vault secret with logged in passowrd
      // if no mathc // create a new vault password // insert a new cordic_login // insert a new cordic_membership row

      // update auth.user with the new password
      
      // return ok

      let { data: updateUser, error: updateUser_error } = await supabaseAdmin.auth.admin.updateUserById( foundUser, { password: password })

      if (updateUser_error) {
          console.log("FAILED TO UPDATE USER PASSWORD")
          return new Response(JSON.stringify({error: "FAILED TO UPDATE USER PASSWORD", details: updateUser_error }), {
           status: 500,
           headers: {"Content-Type": "application/json"}
         })
       }

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
            cLogins = cLoginsInsert

          
      let { data: cMemberships, error: cMemberships_error } = await supabaseAdmin
          .from('cordic_memberships')
          .insert({ cordic_login_id: cLogins.id , user_id: foundUser })
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
    
      return new Response(JSON.stringify({ ok: true, details: 'user successfully updated' }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })

       }











    } else {
      // migrate -> grab phone email and password from loginToCordic -> createUser → vault → insert the type='personal' cordic_logins row + the membership → ok

      let cLogins

      let { data: createUser, error: createUser_error } = await supabaseAdmin.auth.admin
      .createUser({
        email: email,
        password: password,
        email_confirm: true
      })

      console.log('user created: ', createUser);

      if (createUser_error) {
        console.log("FAILED TO CREATE USER")
        return new Response(JSON.stringify({error: "FAILED TO CREATE USER", details: createUser_error }), {
          status: 500,
          headers: {"Content-Type": "application/json"}
        })
      };

      let { data: createProfile, error: createProfile_error } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: createUser.user.id, 
          full_name: cLoginResponse.name, 
          phone: cLoginResponse.canonPhone, 
          cordic_user_id: cLoginResponse.userID, 
          cordic_user_status: cLoginResponse.userStatus,
        })

      if (createProfile_error) {
        console.log("FAILED TO CREATE USER PROFILE")
        return new Response(JSON.stringify({error: "FAILED TO CREATE USER PROFILE", details: createProfile_error }), {
          status: 500,
          headers: {"Content-Type": "application/json"}
        })
      }

      let {data: queryCLogins ,error: queryCLogins_error } = await supabaseAdmin
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
          // is not null, is truthy so update

          let {data: updatePassword , error: updatePassword_error} = await supabaseAdmin.rpc('update_vault_secret', { p_secret_id: queryCLogins.secret_id, p_new_secret: password})

          if (updatePassword_error) {
            console.log("FAILED TO CREATE VAULT SECRET")
            return new Response(JSON.stringify({error: "FAILED TO CREATE VAULT SECRET", details: updatePassword_error }), {
              status: 500,
              headers: {"Content-Type": "application/json"}
            })
          }

          console.log('updated password: -> null ', updatePassword);

          cLogins = queryCLogins

        } else {
          // is null so we insert

          let {data: migratePassword , error: migratePassword_error} = await supabaseAdmin.rpc('create_vault_secret', {secret: password, name: `${date}-${email}`, description: ''})

          console.log('migrate password: ', migratePassword);

          if (migratePassword_error) {
            console.log("FAILED TO CREATE VAULT SECRET")
            return new Response(JSON.stringify({error: "FAILED TO CREATE VAULT SECRET", details: migratePassword_error }), {
              status: 500,
              headers: {"Content-Type": "application/json"}
            })
          }

          let { data: cLoginsInsert, error: cLoginsInsert_error } = await supabaseAdmin
                .from('cordic_logins')
                .insert({ account_number: null, username: email, secret_id: migratePassword, type: 'personal'  })
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

            cLogins = cLoginsInsert
        }

      let { data: cMemberships, error: cMemberships_error } = await supabaseAdmin
          .from('cordic_memberships')
          .insert({ cordic_login_id: cLogins.id , user_id: createUser.user.id })
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
    
      return new Response(JSON.stringify({ ok: true, details: 'user successfully migrated' }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      })

    }


  /*
    if (cLoginResponse?.email && foundUser) {
      // Means email is a cordic user and supabse user
    } else if (cLoginResponse?.email && !foundUser) {
      // Means user needs migrating to supabase
    } else if (!cLoginResponse?.email && foundUser) {
      // Means user is on supabase but has no cordic user_id account
    } else {
      // Completley new user needs accounts for both
    }
*/


  return new Response(JSON.stringify({ ok: true, Details: 'No Action' }))
    } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })}
  }),
}