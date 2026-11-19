import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { articleImage, articleImageAttrs, articleTags, articleTagsMarkup, articlePage } from '../cloudflare/public-pages.mjs';
const { parseMarkdown, stringifyMarkdown } = await import(`data:text/javascript;base64,${readFileSync(new URL('../admin-app/modules/frontmatter.js', import.meta.url)).toString('base64')}`);

test('manual article keeps independent image and tag fields plus legacy values', () => {
  const data = {
    title: 'Praca w Belgii', image: '/images/legacy.png', tags: 'Belgia',
    image_pl: '/images/pl.png', image_nl: '/images/nl.png', image_fr: '/images/fr.png',
    tags_pl: 'praca', tags_nl: 'werk', tags_fr: 'travail'
  };
  const saved = parseMarkdown(stringifyMarkdown(data, 'Treść'));
  assert.deepEqual(saved.data, data);
  assert.equal(saved.body, 'Treść');
  for (const language of ['pl','nl','fr']) {
    assert.equal(articleImage(saved.data, language), data[`image_${language}`]);
    assert.equal(articleTags(saved.data, language), data[`tags_${language}`]);
  }
  assert.equal(articleImage({ image: data.image }, 'fr'), data.image);
  assert.equal(articleTags({ tags: data.tags }, 'nl'), data.tags);
  assert.equal(articleImage({ image_nl: data.image_nl }, 'fr'), '');
});

test('AI article public page includes language images and tags without changing publication', async () => {
  const id = 'a'.repeat(20);
  const row = {
    id, title: 'Tytuł', description: 'Opis', body: 'Treść', category: 'Praca',
    region: 'all', kind: 'article', event_json: null, verification_json: '{}',
    article_fields_json: JSON.stringify({
      image_pl: '/images/pl.png', image_nl: '/images/nl.png', image_fr: '/images/fr.png',
      tags_pl: 'praca', tags_nl: 'werk', tags_fr: 'travail'
    }),
    owner_kind: 'admin', published_at: '2026-11-19T10:00:00Z', scheduled_at: null
  };
  const context = {
    params: { slug: `ai-${id}` },
    request: new Request(`https://example.invalid/artykuly/ai-${id}/`),
    env: {
      DB: { prepare: () => ({ bind: () => ({ first: async () => row }) }) },
      ASSETS: { fetch: async () => new Response('%%IMAGE%% %%TAGS%% %%BODY%% %%TITLE%%') }
    }
  };
  const response = await articlePage(context);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /src="\/images\/pl\.png"/);
  assert.match(html, /data-image-nl="\/images\/nl\.png"/);
  assert.match(html, /data-image-fr="\/images\/fr\.png"/);
  assert.match(html, /data-tags-nl="werk"/);
  assert.match(html, /<span>praca<\/span>/);
  assert.match(articleImageAttrs({ image_nl: '/images/nl.png' }), /data-image-pl=""/);
  assert.match(articleTagsMarkup({ tags_fr: 'travail' }), /data-tags-fr="travail"/);
});
