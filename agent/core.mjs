import { createHash } from 'node:crypto';

export const statuses = ['draft', 'pending_review', 'approved', 'published', 'rejected', 'failed'];
const sensitiveCategories = new Set(['Formalności', 'Zdrowie', 'Podatki', 'Prawo']);
const keywords = /polsk|poloni|belg|bruks|flandr|waloni|praca|zdrow|podat|rodzin|kultur|wydarzen|event|visa|residen|emploi|werk/i;
const entity = value => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|apos|#(\d+));/g, (all, number) => ({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" }[all] ?? (number ? String.fromCodePoint(Number(number)) : all))).trim();
const tag = (xml, name) => entity(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(xml)?.[1]);

export function canonicalUrl(input) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('unsafe URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  url.searchParams.sort();
  return url.toString();
}
export const fingerprint = value => createHash('sha256').update(value).digest('hex');
export const normalizeTitle = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function similarity(first, second) {
  const a = new Set(normalizeTitle(first).split(' ').filter(word => word.length > 2));
  const b = new Set(normalizeTitle(second).split(' ').filter(word => word.length > 2));
  if (!a.size || !b.size) return 0;
  return [...a].filter(word => b.has(word)).length / new Set([...a, ...b]).size;
}

export function parseFeed(xml, source) {
  if (xml.length > 1_000_000) throw new Error('feed too large');
  const atom = /<feed(?:\s|>)/i.test(xml);
  if (!atom && !/<rss(?:\s|>)|<rdf:RDF(?:\s|>)/i.test(xml)) throw new Error('unsupported feed');
  const nodes = [...xml.matchAll(atom ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  return nodes.slice(0, 100).map(([, node]) => {
    const link = atom ? /<link\b[^>]*href=["']([^"']+)["']/i.exec(node)?.[1] : tag(node, 'link');
    if (!link) return null;
    return { id: tag(node, atom ? 'id' : 'guid') || link, kind: 'article', title: tag(node, 'title'), summary: tag(node, atom ? 'summary' : 'description'), url: new URL(link, source.url).toString(), sourceId: source.id, official: Boolean(source.official), publishedAt: tag(node, atom ? 'published' : 'pubDate') || tag(node, 'updated') || null, region: source.region, category: 'Życie w Belgii', claims: [] };
  }).filter(item => item?.title);
}

export function parseHtmlLinks(html, source) {
  if (html.length > 1_000_000) throw new Error('page too large');
  const origin = new URL(source.url);
  const seen = new Set();
  const items = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = entity(match[2]);
    if (title.length < 12 || title.length > 200) continue;
    let url;
    try { url = canonicalUrl(new URL(match[1], source.url).toString()); } catch { continue; }
    if (new URL(url).hostname !== origin.hostname || seen.has(url) || url === canonicalUrl(source.url)) continue;
    seen.add(url);
    items.push({ id: url, kind: 'article', title, summary: title, url, sourceId: source.id, official: Boolean(source.official), publishedAt: null, region: source.region, category: 'Życie w Belgii', claims: [] });
    if (items.length >= 50) break;
  }
  return items;
}

export function scoreTopic(item, now = new Date()) {
  const ageDays = item.publishedAt && Number.isFinite(Date.parse(item.publishedAt)) ? Math.max(0, (now - new Date(item.publishedAt)) / 86400000) : 365;
  const freshness = Math.max(0, 20 - Math.floor(ageDays / 2));
  const credibility = item.official ? 30 : 8;
  const usefulness = keywords.test(`${item.title} ${item.summary}`) ? 25 : 0;
  const regional = item.region && item.region !== 'all' ? 10 : 5;
  return { freshness, credibility, usefulness, regional, total: freshness + credibility + usefulness + regional };
}

export function verifyItem(item, now = new Date()) {
  const issues = [];
  let url;
  try { url = canonicalUrl(item.url); } catch { issues.push('invalid_url'); }
  if (!item.title || !item.summary) issues.push('missing_text');
  if (item.kind === 'event') {
    const event = item.event || {};
    for (const field of ['start', 'end', 'timezone', 'venue', 'city', 'organizer']) if (!event[field]) issues.push(`missing_${field}`);
    if (event.timezone && event.timezone !== 'Europe/Brussels') issues.push('invalid_timezone');
    if (event.start && (!Number.isFinite(Date.parse(event.start)) || new Date(event.start) <= now)) issues.push('past_or_invalid_event');
    if (event.end && (!Number.isFinite(Date.parse(event.end)) || new Date(event.end) <= new Date(event.start))) issues.push('invalid_end');
    if (['cancelled', 'postponed', 'ended'].includes(event.status)) issues.push(`event_${event.status}`);
  } else {
    if (!Array.isArray(item.claims) || !item.claims.length) issues.push('unverified_claims');
    for (const claim of item.claims || []) {
      if (!claim.text || !Array.isArray(claim.sourceUrls) || !claim.sourceUrls.includes(item.url) && !claim.sourceUrls.includes(url)) issues.push('unsupported_claim');
      if (/\d/.test(claim.text) && (!claim.definition || !claim.year || !claim.unit) && claim.statistic) issues.push('statistic_metadata');
    }
    if (sensitiveCategories.has(item.category) && !item.official) issues.push('official_source_required');
  }
  return { status: issues.length ? 'needs_review' : 'verified', issues, checkedAt: now.toISOString(), sourceUrl: url || item.url, publishedAt: item.publishedAt || null, credibility: item.official ? 'official' : 'unconfirmed' };
}

export function duplicateOf(item, existing) {
  let url;
  try { url = canonicalUrl(item.url); } catch { return null; }
  const title = normalizeTitle(item.title);
  return existing.find(other => {
    if (other.sourceId === item.sourceId && other.externalId === item.id || other.canonicalUrl === url) return true;
    if (item.kind !== other.kind) return false;
    if (item.event && (other.event?.start !== item.event.start || normalizeTitle(other.event?.city) !== normalizeTitle(item.event.city))) return false;
    return normalizeTitle(other.title) === title || similarity(other.title, item.title) >= 0.85 && similarity(other.summary, item.summary) >= 0.7;
  }) || null;
}

export function draftFromItem(item, verification, now = new Date()) {
  if (verification.status !== 'verified') return null;
  const source = verification.sourceUrl;
  const isEvent = item.kind === 'event';
  const body = isEvent
    ? `Materiał testowy. ${item.summary}\n\n## Szczegóły\n\n- Początek: ${item.event.start}\n- Koniec: ${item.event.end}\n- Miejsce: ${item.event.venue}, ${item.event.city}\n- Organizator: ${item.event.organizer}\n\n## Źródło\n\n- [Strona organizatora](${source})\n`
    : `Materiał testowy. ${item.summary}\n\n## Potwierdzone informacje\n\n${item.claims.map(claim => `- ${claim.text}`).join('\n')}\n\n## Źródło\n\n- [Komunikat źródłowy](${source})\n`;
  return { id: fingerprint(`${item.sourceId}:${item.id}`).slice(0, 20), kind: item.kind, status: 'pending_review', aiGenerated: false, title: item.title, description: item.summary, body, category: item.category || 'Życie w Belgii', region: item.region || 'all', tags: [], createdAt: now.toISOString(), updatedAt: now.toISOString(), sources: [{ url: source, fetchedAt: now.toISOString(), publishedAt: item.publishedAt || null }], verification, event: isEvent ? item.event : null, cmsPath: null };
}

export function processItems(items, state, { now = new Date(), dryRun = false, maxPending = 21 } = {}) {
  const next = structuredClone(state);
  next.items ||= []; next.drafts ||= []; next.runs ||= [];
  const report = { at: now.toISOString(), found: items.length, created: 0, duplicates: 0, rejected: 0, errors: [], dryRun };
  for (const item of items) {
    const duplicate = duplicateOf(item, next.items);
    if (duplicate) { report.duplicates++; continue; }
    const verification = verifyItem(item, now);
    const score = scoreTopic(item, now);
    const record = { ...item, externalId: item.id, canonicalUrl: verification.sourceUrl, verification, score, fetchedAt: now.toISOString() };
    next.items.push(record);
    if (verification.status !== 'verified' || score.total < 50) { report.rejected++; continue; }
    const draft = draftFromItem(item, verification, now);
    if (draft && next.drafts.filter(entry => entry.status === 'pending_review').length < maxPending) { next.drafts.push(draft); report.created++; }
  }
  next.runs.push(report);
  return { state: dryRun ? state : next, report };
}
