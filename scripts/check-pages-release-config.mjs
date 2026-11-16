// Read-only guard. Do not use this script to deploy or change Cloudflare settings.
import {readFileSync} from 'node:fs';

const expected={
  test:{file:'wrangler.toml',name:'polacywbelgii-test',database:'polacywbelgii-test',id:'76deb616-3e1d-4a64-9c68-7275336a91d4',stripe:'1'},
  production:{file:'wrangler.production.toml',name:'polacywbelgii',database:'polacywbelgii-preview',id:'be9435a1-b3ff-41dc-b70d-6f79f768d887',stripe:'0'}
};
for(const [environment,rule] of Object.entries(expected)){
  const content=readFileSync(rule.file,'utf8');
  const value=key=>new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`,'m').exec(content)?.[1];
  const count=token=>content.split(token).length-1;
  if(value('name')!==rule.name||value('pages_build_output_dir')!=='./_site'||count('[[d1_databases]]')!==1||value('binding')!=='DB'||value('database_name')!==rule.database||value('database_id')!==rule.id||value('CMS_CONTENT_BACKEND')!=='d1'||value('STRIPE_TEST_MODE')!==rule.stripe||value('AI_AUTOMATION_ENABLED')!=='0'||value('GEMINI_FREE_TIER_CONFIRMED')!=='0')throw new Error(`${environment} Pages configuration mismatch`);
  console.log(`${environment}: configuration and D1 binding verified`);
}
