// Cloudflare bootstrap. Secrets stay in the GitHub Actions environment.
import { appendFileSync, writeFileSync, readFileSync } from "node:fs";

const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !/^[a-f0-9]{32}$/i.test(account||"")) {
  throw Error("Cloudflare API token or 32-character account ID not configured");
}
const base="https://api.cloudflare.com/client/v4/accounts/"+account;
async function cf(path, options={}){
  const response=await fetch(base+path,{
    method:options.method||"GET",
    headers:{Authorization:"Bearer "+token,...(options.body?{"content-type":"application/json"}:{})},
    ...(options.body?{body:JSON.stringify(options.body)}:{})
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok || body?.success!==true){
    const codes=Array.isArray(body?.errors)?body.errors.map(x=>x.code).join(","):"unknown";
    throw Error("Cloudflare "+(options.method||"GET")+" "+path.split("?")[0]+
      " failed (HTTP "+response.status+"; error codes "+codes+")");
  }
  return body.result;
}
const databases=await cf("/d1/database?name=quickquote-pro&per_page=100");
if(!Array.isArray(databases))throw Error("Unexpected Cloudflare D1 listing");
const matches=databases.filter(v=>v.name==="quickquote-pro");
if(matches.length>1)throw Error("Multiple QuickQuote D1 databases found");
let databaseId=matches[0]?.uuid;
if(!databaseId){
  const created=await cf("/d1/database",{method:"POST",body:{name:"quickquote-pro"}});
  databaseId=created?.uuid;
  console.log("Provisioned isolated QuickQuote D1 database.");
}else console.log("Reusing existing QuickQuote D1 database.");
if(!/^[a-f0-9-]{36}$/i.test(databaseId||""))throw Error("Invalid D1 UUID returned");
const subdomainInfo=await cf("/workers/subdomain");
const subdomain=subdomainInfo?.subdomain;
if(!/^[a-z0-9-]+$/i.test(subdomain||""))throw Error("No valid workers.dev subdomain");
const workerOrigin="https://quickquote-pro."+subdomain+".workers.dev";
const template=readFileSync(new URL("../wrangler.toml.example",import.meta.url),"utf8");
writeFileSync(new URL("../wrangler.toml",import.meta.url),
  template.replace("REPLACE_WITH_REAL_D1_DATABASE_ID",databaseId),{mode:0o600});
appendFileSync(process.env.GITHUB_ENV,"QUICKQUOTE_WORKER_URL="+workerOrigin+"\n");
console.log("Prepared private Wrangler config and found Workers subdomain.");
