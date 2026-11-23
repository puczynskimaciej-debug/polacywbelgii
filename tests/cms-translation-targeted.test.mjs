import test from 'node:test';
import assert from 'node:assert/strict';
import { translateFields } from '../cloudflare/ai-translation.mjs';

const env = () => ({
  GEMINI_API_KEY: 'test-only',
  DB: { prepare(sql) { return { bind() { return { run: async () => sql.startsWith('UPDATE') ? { meta: { changes: 1 } } : {} }; } }; } }
});
const answer = fields => async (_url, options) => {
  const request = JSON.parse(options.body);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(fields) }] } }] }) };
};

test('single article field translates in one request', async () => {
  let calls = 0;
  const fetcher = async (...args) => { calls++; return answer({ title: 'Wiadomość z Belgii' })(...args); };
  const result = await translateFields(env(), { kind: 'article', language: 'nl', fields: { title: 'Wiadomość z Belgii' } }, fetcher);
  assert.equal(result.title, 'Wiadomość z Belgii');
  assert.equal(calls, 1);
});

test('whole event form uses one request and preserves Markdown URL', async () => {
  let calls = 0;
  const fetcher = async (...args) => { calls++; return answer({ title: 'Tytuł FR', description: 'Opis FR', body: '**Gras** [service](https://example.org/form)' })(...args); };
  const result = await translateFields(env(), { kind: 'event', language: 'fr', fields: { title: 'Tytuł', description: 'Opis', body: '**Pogrubienie** [usługa](https://example.org/form)' } }, fetcher);
  assert.equal(result.body.includes('https://example.org/form'), true);
  assert.equal(calls, 1);
});

test('rejects a changed Markdown URL and event tags', async () => {
  await assert.rejects(() => translateFields(env(), { kind: 'article', language: 'fr', fields: { body: '[formularz](https://example.org/form)' } }, answer({ body: '[formulaire](https://wrong.example/form)' })));
  await assert.rejects(() => translateFields(env(), { kind: 'event', language: 'fr', fields: { tags: 'Praca' } }, answer({ tags: 'Travail' })));
});
