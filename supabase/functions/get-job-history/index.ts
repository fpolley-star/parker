import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: ["user"] }, async (req, ctx) => {
    // ctx.userClaims = { id, email, role, ... }
    const { loginID } = await req.json().catch(() => ({}));
    const p_user_id = ctx.userClaims?.id;

    const { data: queryLogin, error:  queryLogin_error } = await ctx.supabaseAdmin
    .from("cordic_logins")
    .select()
    .eq( "id", loginID)
    .single()

    if (queryLogin_error) {
      console.log("Failed to read login: ", queryLogin_error);
      return new Response(JSON.stringify({error: queryLogin_error, msg: "Failed to read login" }),
      {status: 500, headers: { "Content-Type": "application/json"}})
    }

    console.log("Login Read, Type :", queryLogin.type);


    const tokenType = queryLogin.type

    let token


    if (tokenType === 'personal') {
      const { data: personalMint, error: personalMint_error } =
        await ctx.supabaseAdmin.functions.invoke("personal-minter", {
          body: { cordic_login_id: loginID, user_id: p_user_id },
        });

      if (personalMint_error) {
        console.log("Unable to mint personal token: ", personalMint_error);
        return new Response(
          JSON.stringify({ error: "Unable to mint personal token", details: personalMint_error }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      token = personalMint?.token;
      console.log("Personal Token: ", token);

    } else {
      const {data: accountMint, error: accountMint_error } = 
        await ctx.supabase.functions.invoke('corporate-minter', {
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
    }


    // Main Action

    const jobHistoryBodyAvtive = {
      "version": "2.0",
      "search": {
        "startEpoch": "",
        "endEpoch": "",
        "lastJobID": 0
      },
      "filter": {
        "activeJobs": true,
        "jobTypes": "allJobs",
        "accUserID": 0
      },
      "accountUsers": []
    }
    const jobHistoryBody = {
      "version": "2.0",
      "search": {
        "startEpoch": "",
        "endEpoch": "",
        "lastJobID": 0
      },
      "filter": {
        "activeJobs": false,
        "jobTypes": "allJobs",
        "accUserID": 0
      },
      "accountUsers": []
    }

    const jobHistoryUrl = "https://www.parkercorporate.co.uk/smartserver/SmartSrvISAPI.dll?jobhistory"
    const jobHistoryHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }

     const [jobHistoryActiveResult, jobHistoryResult] = await Promise.all([
      fetch(jobHistoryUrl, {
        method: 'POST',
        headers: jobHistoryHeaders,
        body: JSON.stringify(jobHistoryBodyAvtive)
      }).then(r => r.json()),
      fetch(jobHistoryUrl, {
        method: 'POST',
        headers: jobHistoryHeaders,
        body: JSON.stringify(jobHistoryBody)
      }).then(r => r.json())
     ])


    const allJobs = [
      ...jobHistoryActiveResult.history,
      ...jobHistoryResult.history
    ]
    
    return Response.json({ 
      ok: true,
      jobs: {history: allJobs}
    }, {
      status: 200,
      headers: {"Content-Type": "application/json" },
    })
  }),
};