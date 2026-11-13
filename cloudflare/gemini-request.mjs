export async function geminiRequest(env,body,timeoutMs=45000,fetcher=fetch) {
  const relay = env.GEMINI_LOCAL_RELAY_URL === 'http://127.0.0.1:8793' && env.GEMINI_LOCAL_RELAY_TOKEN;
  return fetcher(relay ? `${env.GEMINI_LOCAL_RELAY_URL}/generate` : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{
    method:'POST',
    headers:relay ? {'Content-Type':'application/json','x-pbe-relay-token':env.GEMINI_LOCAL_RELAY_TOKEN} : {'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
    body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)
  });
}
