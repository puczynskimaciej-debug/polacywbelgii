import { localGeminiKey } from './gemini.mjs';

const key = localGeminiKey();
if (!key) throw new Error('GEMINI_API_KEY is missing');
let response;
try { response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{ headers:{ 'x-goog-api-key':key }, signal:AbortSignal.timeout(15000), redirect:'error' }); }
catch { throw new Error('Gemini model list request failed'); }
if (!response.ok) throw new Error(`Gemini model list HTTP ${response.status}`);
const payload = await response.json();
console.log(JSON.stringify((payload.models || []).filter(model => model.supportedGenerationMethods?.includes('generateContent') && /^models\/gemini-/.test(model.name)).map(model => model.name.slice(7))));
