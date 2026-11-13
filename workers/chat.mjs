import { processChatJobs } from '../cloudflare/ai-chat-worker.mjs';
export default { async scheduled(_controller,env) { const result = await processChatJobs(env); console.log(JSON.stringify({job:'ai-chat',status:result.status,error:result.error || null})); } };
