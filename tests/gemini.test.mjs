import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGeminiArticle, parseLocalGeminiKey } from '../agent/gemini.mjs';

const evidence = { sources: [{ url: 'https://example.org/official' }], claims: [{ text: 'Test fact', sourceUrl: 'https://example.org/official' }] };
test('local env parser reads the expected key without exposing unrelated values', () => {
  assert.equal(parseLocalGeminiKey('OTHER=value\nGEMINI_API_KEY="example-key"\n'),'example-key');
  assert.equal(parseLocalGeminiKey('OTHER=value\n'),'');
});
test('Gemini refuses calls without key and free-tier confirmation', async () => {
  await assert.rejects(generateGeminiArticle({ evidence, apiKey: '' }), /GEMINI_API_KEY/);
  await assert.rejects(generateGeminiArticle({ evidence, apiKey: 'test', freeTierConfirmed: false }), /free-tier/);
});
test('Gemini adapter validates output and reports usage without making a real API call', async () => {
  let calls = 0;
  const result = await generateGeminiArticle({ evidence, apiKey: 'test', freeTierConfirmed: true, fetcher: async (url, options) => {
    calls++;
    assert.match(url, /gemini-3.5-flash-lite/);
    assert.equal(options.headers['x-goog-api-key'], 'test');
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Test', description: 'Test', category: 'Test', region: 'all', body: '## Test' }) }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 } }) };
  } });
  assert.equal(calls, 1);
  assert.equal(result.usage.outputTokens, 34);
  assert.equal(result.needsHumanReview, true);
});
