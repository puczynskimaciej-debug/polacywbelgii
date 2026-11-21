import { processChatJobs } from '../cloudflare/ai-chat-worker.mjs';
import { queueMorning } from '../cloudflare/ai-morning.mjs';
import { editorialStyleContext } from '../cloudflare/editorial-style.mjs';
export default { async scheduled(_controller,env) { await editorialStyleContext(env).catch(()=>{}); const morning=await queueMorning(env); const result=await processChatJobs(env); console.log(JSON.stringify({job:'ai-chat',morning:morning.status,status:result.status,error:result.error || null})); } };
