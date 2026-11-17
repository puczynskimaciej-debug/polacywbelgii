import { publicEntries } from '../cloudflare/public-pages.mjs';

const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const translated = (entry, field) => ['nl','fr'].filter(lang => entry[`${field}_${lang}`]).map(lang => `data-translation-${lang}="${escape(entry[`${field}_${lang}`])}"`).join(' ');

export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new Request(new URL('/index.html',context.request.url)));
  if (!asset.ok) return asset;
  const entries = (await publicEntries(context.env.DB,'article')).slice(0,6);
  const cards = entries.map(entry => `<article class="news-card" data-region="${escape(entry.region || 'all')}"><a class="news-card__image" href="${escape(entry.url)}"><img src="${escape(entry.image || '/images/hero.jpg')}" alt="" loading="lazy"></a><div class="news-card__body"><div class="article-meta"><span class="tag" data-category>${escape(entry.category || 'Poradnik')}</span><time datetime="${escape(entry.date)}">${escape(entry.date ? new Date(entry.date).toLocaleDateString('pl-PL',{timeZone:'Europe/Brussels'}) : '')}</time></div><h3><a href="${escape(entry.url)}" ${translated(entry,'title')}>${escape(entry.title)}</a></h3><p ${translated(entry,'description')}>${escape(entry.description)}</p><a class="card-link" href="${escape(entry.url)}"><span data-i18n="articles.read">Czytaj artykuł</span> →</a></div></article>`).join('');
  const empty = '<p class="empty-state" data-i18n="articles.emptyText">Pierwsze artykuły są w przygotowaniu.</p>';
  const html = (await asset.text()).replace(/<!-- CMS_LATEST_START -->[\s\S]*?<!-- CMS_LATEST_END -->/,`<!-- CMS_LATEST_START -->${cards || empty}<!-- CMS_LATEST_END -->`);
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
