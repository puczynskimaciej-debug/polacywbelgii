const { readiness } = require('../../server/deployment');
const { reply } = require('../../server/http');
exports.handler = async event => {
  if (event.httpMethod !== 'GET') return reply(405, { ready: false });
  const { ready } = await readiness();
  // Diagnostics are only printed by the operator's CLI, never exposed publicly.
  return reply(ready ? 200 : 503, { ready });
};
