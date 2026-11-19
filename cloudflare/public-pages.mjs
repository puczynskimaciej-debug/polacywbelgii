import yaml from 'js-yaml';
import MarkdownIt from 'markdown-it';
import { publicContent, readContent } from './content-store.mjs';
import { eventPublic } from './event-data.mjs';

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const eventDate = value => String(value || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1');
const eventDateTime = value => new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Brussels',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value), char => char.charCodeAt(0)));
const notFound = () => new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

function parseFile(file) {
  const match = decode(file.content).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const data = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
  return { ...data, body: match[2], date: file.published_at || data.date, slug: file.name.replace(/\.md$/, ''), status: file.status, url: `/artykuly/${file.name.replace(/\.md$/, '')}/` };
}
function aiRow(row) {
  const event = row.event_json ? JSON.parse(row.event_json) : null;
  const verification = row.verification_json ? JSON.parse(row.verification_json) : {};
  const fields = row.article_fields_json ? JSON.parse(row.article_fields_json) : {};
  return { slug: `ai-${row.id}`, url: row.kind === 'event' ? `/wydarzenia/ai-${row.id}/` : `/artykuly/ai-${row.id}/`, title: row.title, description: row.description, body: row.body, ...fields, date: row.published_at || row.scheduled_at, category: row.kind === 'event' && ['History','Music'].includes(row.category) ? 'Inne' : row.category, region: row.region, contentType: row.kind, event, image:event?.image || fields.image || null, verification, manual:row.owner_kind === 'admin' };
}
const aiPublicSql = "SELECT c.id,c.title,c.description,c.body,c.category,c.region,c.kind,c.event_json,c.article_fields_json,c.verification_json,e.owner_kind,e.published_at,e.scheduled_at FROM ai_candidates c JOIN ai_editorial e ON e.candidate_id=c.id WHERE e.status='published' AND e.public_state='visible' AND e.approved_by IS NOT NULL AND e.approved_at IS NOT NULL";

export async function publicEntries(db, kind = null) {
  const manual = (await publicContent(db, 'article')).map(parseFile).filter(Boolean);
  const ai = (await db.prepare(aiPublicSql).all()).results.map(aiRow);
  return [...manual, ...ai].filter(item => (!kind || (item.contentType || 'article') === kind) && (item.contentType !== 'event' || eventPublic(item.event,item.manual) && item.verification?.status === 'verified')).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
export async function publicEntry(db, slug) {
  if (/^ai-[a-f0-9]{20}$/.test(slug)) {
    const row = await db.prepare(`${aiPublicSql} AND c.id=?`).bind(slug.slice(3)).first();
    if (!row) return null;
    const entry = aiRow(row);
    return entry.contentType !== 'event' || eventPublic(entry.event,entry.manual) && entry.verification?.status === 'verified' ? entry : null;
  }
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  try { const file = await readContent(db, `src/content/articles/${slug}.md`); return file.status === 'published' ? parseFile(file) : null; }
  catch (error) { if (error.status === 404) return null; throw error; }
}
async function shell(context, pathname) {
  const response = await context.env.ASSETS.fetch(new Request(new URL(pathname, context.request.url)));
  if (!response.ok) throw new Error(`Missing dynamic shell ${pathname}`);
  return response.text();
}
function page(html) { return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function replace(html, values) { return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`%%${key}%%`, value), html); }

export async function articlePage(context) {
  const entry = await publicEntry(context.env.DB, context.params.slug);
  if (!entry) return notFound();
  const html = await shell(context, '/dynamic-article.html');
  const date = entry.event ? entry.event.start ? eventDateTime(entry.event.start) : eventDate(entry.event.date) : entry.date ? new Date(entry.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' }) : '';
  const image = entry.image ? `<div class="single-article__image container"><img src="${escape(entry.image)}" alt=""></div>` : '';
  const translations = ['en', 'nl', 'fr'].map(lang => entry[`body_${lang}`] ? `<template data-article-translation="${lang}">${markdown.render(entry[`body_${lang}`])}</template>` : '').join('');
  const attrs = field => ['en','nl','fr'].filter(lang => entry[`${field}_${lang}`]).map(lang => `data-translation-${lang}="${escape(entry[`${field}_${lang}`])}"`).join(' ');
  const sources = entry.sources ? `<section><h2>Źródła</h2><ul>${entry.sources.split(/\r?\n/).filter(Boolean).map(url => `<li><a href="${escape(url.trim())}" rel="noopener noreferrer">${escape(url.trim())}</a></li>`).join('')}</ul></section>` : '';
  const ev = entry.event;
  const eventTerm = !ev?.date && !ev?.start ? 'Termin do ustalenia' : ev?.start ? eventDateTime(ev.start) : eventDate(ev.date);
  const event = ev ? `<section><h2>Szczegóły wydarzenia</h2><p>${ev.end && Date.parse(ev.end) < Date.now() ? '<strong>Zakończone</strong><br>' : ''}${ev.organizer ? `Organizator: ${escape(ev.organizer)}<br>` : ''}${ev.venue || ev.city ? `Miejsce: ${escape([ev.venue,ev.city].filter(Boolean).join(', '))}<br>` : ''}${ev.address ? `Adres: ${escape(ev.address)}<br>` : ''}Termin: ${escape(eventTerm)}${ev.price !== undefined && ev.price !== null ? `<br>Cena: ${ev.price === 0 ? 'Bezpłatnie' : `${escape(ev.price)} EUR`}` : ''}</p>${ev.sourceUrl ? `<p><a href="${escape(ev.sourceUrl)}" rel="noopener noreferrer">Strona organizatora</a></p>` : ''}<small>Ostatnie potwierdzenie: ${escape(entry.verification.checkedAt)}</small></section>` : '';
  const schema = ev && (ev.start || ev.date) && entry.title ? `<script type="application/ld+json">${JSON.stringify({ '@context':'https://schema.org','@type':'Event',name:entry.title,description:entry.description,startDate:ev.start || ev.date,...(ev.end || ev.endDate ? {endDate:ev.end || ev.endDate}:{}),eventStatus:'https://schema.org/EventScheduled',...(ev.venue || ev.city ? {location:{'@type':'Place',name:ev.venue || ev.city,address:ev.address || ev.city}} : {}),...(ev.organizer ? {organizer:{'@type':'Organization',name:ev.organizer}} : {}),url:new URL(entry.url,context.request.url).href,...(ev.price !== undefined && ev.price !== null && ev.sourceUrl ? {offers:{'@type':'Offer',price:ev.price,priceCurrency:'EUR',url:ev.sourceUrl}}:{})}).replace(/</g,'\\u003c')}</script>` : '';
  return page(replace(html, { TITLE: escape(entry.title || (ev ? 'Wydarzenie bez tytułu' : '')), TITLE_I18N:attrs('title'), DESCRIPTION: escape(entry.description), DESCRIPTION_I18N:attrs('description'), CATEGORY: escape(entry.category || 'Poradnik'), DATE: escape(date), DATE_ISO: escape(ev?.start || ev?.date || entry.date), DATE_ATTRIBUTE: ev ? 'data-event-date' : '', IMAGE: image, BODY: event + markdown.render(entry.body || '') + sources + schema, TRANSLATIONS: translations, CANONICAL: escape(new URL(entry.url, context.request.url).href) }));
}

export async function listingPage(context, kind) {
  const entries = await publicEntries(context.env.DB, kind);
  const template = await shell(context, kind === 'event' ? '/dynamic-events.html' : '/dynamic-list.html');
  const rows = entries.map((entry, index) => `<article class="article-row ${index % 2 ? 'article-row--reverse' : ''}" data-region="${escape(entry.region || 'all')}" data-event-region="${escape(entry.region || 'all')}"><a class="article-row__image" href="${escape(entry.url)}"><img src="${escape(entry.image || '/images/hero.jpg')}" alt="" loading="lazy"></a><div class="article-row__content"><div class="article-meta"><span class="tag" data-category>${escape(entry.category || (kind === 'event' ? 'Wydarzenie' : 'Poradnik'))}</span><time datetime="${escape(entry.date)}" ${kind === 'event' ? 'data-event-date' : ''}>${escape(kind === 'event' ? entry.event?.date ? entry.event.start ? eventDateTime(entry.event.start) : eventDate(entry.event.date) : 'Termin do ustalenia' : entry.date ? new Date(entry.date).toLocaleDateString('pl-PL') : '')}</time></div><h2><a href="${escape(entry.url)}">${escape(entry.title || 'Wydarzenie bez tytułu')}</a></h2><p>${escape(entry.description)}${entry.event?.end && Date.parse(entry.event.end) < Date.now() ? ' · Zakończone' : ''}</p><a class="text-link" href="${escape(entry.url)}">Czytaj artykuł →</a></div></article>`).join('');
  const localizedRows=entries.reduce((html,entry)=>{
    const attributes=field=>['nl','fr'].filter(lang=>entry[`${field}_${lang}`]).map(lang=>`data-translation-${lang}="${escape(entry[`${field}_${lang}`])}"`).join(' ');
    return html.replace(`<h2><a href="${escape(entry.url)}">`,`<h2><a href="${escape(entry.url)}" ${attributes('title')}>`).replace(`<p>${escape(entry.description)}`,`<p ${attributes('description')}>${escape(entry.description)}`);
  },rows);
  return page(replace(template, { ROWS: localizedRows || '<p>Brak opublikowanych materiałów.</p>' }));
}
