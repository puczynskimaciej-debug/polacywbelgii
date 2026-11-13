import { publishDue } from '../cloudflare/publication.mjs';

export default {
  async scheduled(_controller, env) {
    if (!env.DB) throw new Error('D1 binding missing');
    const result = await publishDue(env.DB);
    console.log(JSON.stringify({ job: 'publication', count: result.published.length }));
  }
};
