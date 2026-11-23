import { currentUser } from './auth.mjs';
import { errorResponse, fail, json, readJson } from './common.mjs';
import { geminiRequest } from './gemini-request.mjs';

const limits = { title: 180, description: 500, body: 50000, tags: 500 };
const markdownUrls = text => [...text.matchAll(/!?(?:\[[^\]]*\])\((https?:\/\/[^\s)]+)\)/g)].map(match => match[1]);
const markdownShape = text => [
  (text.match(/^#{1,6}\s/gm) || []).length,
  (text.match(/^\s*(?:[-*+]\s|\d+\.\s)/gm) || []).length,
  (text.match(/\*\*/g) || []).length,
  (text.match(/^```/gm) || []).length
];

export async function translateFields(env, input, fetcher = fetch) {
    if (!input || !['article', 'event'].includes(input.kind) || !['nl', 'fr'].includes(input.language) || !input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) fail('validation');
    const allowed = input.kind === 'article' ? Object.keys(limits) : ['title', 'description', 'body'];
    const entries = Object.entries(input.fields);
    if (!entries.length || entries.length > allowed.length || entries.some(([key, value]) => !allowed.includes(key) || typeof value !== 'string' || !value.trim() || value.length > limits[key])) fail('validation');
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare('INSERT OR IGNORE INTO ai_daily_budget(day,calls) VALUES(?,0)').bind(`translation:${day}`).run();
    const budget = await env.DB.prepare('UPDATE ai_daily_budget SET calls=calls+1 WHERE day=? AND calls<20').bind(`translation:${day}`).run();
    if (!budget.meta?.changes) fail('translationLimit', 429);
    const instruction = `Przetłumacz podany obiekt JSON z polskiego na ${input.language === 'nl' ? 'naturalny niderlandzki używany w Belgii' : 'naturalny francuski używany w Belgii'}. Zwróć wyłącznie obiekt JSON z identycznymi kluczami i wartościami tekstowymi. To wierne tłumaczenie, nie pisanie nowej treści. Zachowaj fakty, liczby, cytaty, nazwy własne, kolejność akapitów, strukturę Markdown, nagłówki, listy, pogrubienia, hiperłącza i adresy URL bez zmian. Nie dodawaj ani nie skracaj informacji. Tagi tłumacz na krótkie naturalne odpowiedniki. Zachowaj profesjonalny, przystępny styl. Dane wejściowe: ${JSON.stringify(input.fields)}`;
    let response;
    try { response = await geminiRequest(env, { contents: [{ parts: [{ text: instruction }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 16000, responseMimeType: 'application/json' } }, 60000, fetcher); }
    catch { fail('geminiNetwork', 503); }
    if (!response.ok) fail(`geminiHttp${response.status}`, 503);
    const payload = await response.json();
    const raw = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
    let translated;
    try { translated = JSON.parse(raw); } catch { fail('geminiInvalid', 502); }
    if (!translated || typeof translated !== 'object' || Array.isArray(translated) || Object.keys(translated).length !== entries.length || entries.some(([key, source]) => typeof translated[key] !== 'string' || !translated[key].trim() || translated[key].length > limits[key] || markdownUrls(source).some(url => !markdownUrls(translated[key]).includes(url)) || key === 'body' && markdownShape(source).some((count, index) => count !== markdownShape(translated[key])[index]))) fail('geminiInvalid', 502);
    return translated;
}

export async function onRequest({ request, env }) {
  try {
    if (request.method !== 'POST') fail('method', 405);
    if (!env.DB || !env.GEMINI_API_KEY || env.GEMINI_FREE_TIER_CONFIRMED !== '1') fail('geminiUnavailable', 503);
    await currentUser(request, env, { admin: true });
    const input = await readJson(request, 55000);
    return json({ fields: await translateFields(env, input) });
  } catch (error) { return errorResponse(error); }
}
