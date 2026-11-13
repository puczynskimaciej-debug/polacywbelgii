export function onRequest() { return new Response('Not Found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } }); }
