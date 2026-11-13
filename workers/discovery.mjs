import { runDiscovery } from '../cloudflare/discovery.mjs';

export default {
  async scheduled(controller, env) {
    const kind = controller.cron === '0 7 * * *' ? 'event' : 'article';
    const result = await runDiscovery(kind,env);
    console.log(JSON.stringify({ job:`${kind}-discovery`, status:result.status, found:result.found || 0, created:result.created || 0, errors:result.errors?.length || 0 }));
  }
};
