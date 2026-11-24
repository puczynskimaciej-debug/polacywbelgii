import { publicEntries } from '../../cloudflare/public-pages.mjs';
import { json } from '../../cloudflare/common.mjs';
export async function onRequestGet({ env }) {
  if (!env.DB || env.CMS_CONTENT_BACKEND !== 'd1') return json({ events: [] });
  const events = (await publicEntries(env.DB,'event')).filter(entry => entry.event).map(entry => ({ url: entry.url, title: entry.title, title_nl: entry.title_nl || null, title_fr: entry.title_fr || null, description: entry.description, description_nl: entry.description_nl || null, description_fr: entry.description_fr || null, category: entry.category, region: entry.event.region, city: entry.event.city, venue: entry.event.venue, address: entry.event.address || null, organizer: entry.event.organizer, sourceUrl: entry.event.sourceUrl, date: entry.event.date || null, start: entry.event.start, end: entry.event.end || null, endDate: entry.event.endDate || null, isHoliday: entry.event.isHoliday === true, price: entry.event.price ?? null, familyFriendly: entry.event.familyFriendly === true, verifiedAt: entry.verification.checkedAt, image: entry.image || null }));
  return json({ events });
}
