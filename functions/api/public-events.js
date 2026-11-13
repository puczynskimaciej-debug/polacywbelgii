import { publicEntries } from '../../cloudflare/public-pages.mjs';
import { json } from '../../cloudflare/common.mjs';
export async function onRequestGet({ env }) {
  if (!env.DB || env.CMS_CONTENT_BACKEND !== 'd1') return json({ events: [] });
  const events = (await publicEntries(env.DB,'event')).filter(entry => entry.event).map(entry => ({ url: entry.url, title: entry.title, description: entry.description, category: entry.event.category, region: entry.event.region, city: entry.event.city, venue: entry.event.venue, address: entry.event.address || null, organizer: entry.event.organizer, sourceUrl: entry.event.sourceUrl, date: entry.event.date || null, start: entry.event.start, endDate: entry.event.endDate || null, end: entry.event.end || null, price: entry.event.price ?? null, familyFriendly: entry.event.familyFriendly === true, verifiedAt: entry.verification.checkedAt, image: entry.image || null }));
  return json({ events });
}
