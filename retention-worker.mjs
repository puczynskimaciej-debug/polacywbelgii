import { runRetention } from './cloudflare/retention.mjs';

export default {
  fetch() { return new Response('Not found', {status:404}); },
  scheduled(_controller, env, context) {
    context.waitUntil(runRetention(env).catch(error => {
      // Only fixed error categories are emitted; no record identifiers or personal data.
      console.error('retention_job_failed', error.message === 'retention_disabled' ? 'disabled' : 'execution_error');
      throw error;
    }));
  }
};
