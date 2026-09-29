// Keep domain handlers independent of the hosting API while using the modern
// Netlify runtime, which resolves the isolated database for each deployment.
export function adapt(handler) {
  return async (request, context) => {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers);
    if (context?.ip) headers['x-nf-client-connection-ip'] = context.ip;
    const result = await handler({
      httpMethod: request.method,
      headers,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: ['GET', 'HEAD'].includes(request.method) ? '' : await request.text(),
      isBase64Encoded: false
    });
    const body = result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body;
    return new Response(request.method === 'HEAD' ? null : body, { status: result.statusCode, headers: result.headers });
  };
}
