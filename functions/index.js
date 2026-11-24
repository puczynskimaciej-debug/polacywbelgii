import { publicEntries, articleImage, articleImageAttrs, articleTagsMarkup } from '../cloudflare/public-pages.mjs';

const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const translated = (entry, field) => ['nl','fr'].filter(lang => entry[`${field}_${lang}`]).map(lang => `data-translation-${lang}="${escape(entry[`${field}_${lang}`])}"`).join(' ');
const socialCopy = {
  nl:{title:'Polacy w Belgii — informatie, gidsen en evenementen',description:'Praktische informatie, artikels, evenementen en advertenties voor Polen in België.',locale:'nl_BE'},
  fr:{title:'Polacy w Belgii — informations, guides et événements',description:'Informations pratiques, articles, événements et annonces pour les Polonais en Belgique.',locale:'fr_BE'}
};
const setMeta = (html, attribute, name, value) => html.replace(new RegExp(`(<meta ${attribute}="${name}" content=")[^"]*(")`),(_,start,end)=>`${start}${escape(value)}${end}`);

export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new Request(new URL('/index.html',context.request.url)));
  if (!asset.ok) return asset;
  const entries = (await publicEntries(context.env.DB,'article')).slice(0,3);
  const cards = entries.map(entry => `<article class="news-card" data-region="${escape(entry.region || 'all')}"><a class="news-card__image" href="${escape(entry.url)}"><img src="${escape(articleImage(entry) || '/images/hero.jpg')}" alt="" loading="lazy" ${articleImageAttrs(entry,'/images/hero.jpg')}></a><div class="news-card__body"><div class="article-meta"><span class="tag" data-category>${escape(entry.category || 'Poradnik')}</span><time datetime="${escape(entry.date)}">${escape(entry.date ? new Date(entry.date).toLocaleDateString('pl-PL',{timeZone:'Europe/Brussels'}) : '')}</time></div><h3><a href="${escape(entry.url)}" ${translated(entry,'title')}>${escape(entry.title)}</a></h3><p ${translated(entry,'description')}>${escape(entry.description)}</p>${articleTagsMarkup(entry)}<a class="card-link" href="${escape(entry.url)}"><span data-i18n="articles.read">Czytaj artykuł</span> →</a></div></article>`).join('');
  const empty = '<p class="empty-state" data-i18n="articles.emptyText">Pierwsze artykuły są w przygotowaniu.</p>';
  let html = (await asset.text()).replace(/<!-- CMS_LATEST_START -->[\s\S]*?<!-- CMS_LATEST_END -->/,`<!-- CMS_LATEST_START -->${cards || empty}<!-- CMS_LATEST_END -->`);
  const language = new URL(context.request.url).searchParams.get('lang');
  if (socialCopy[language]) {
    const social = socialCopy[language];
    html = html.replace('<html lang="pl">',`<html lang="${language}">`);
    html = html.replace(/<title>[^<]*<\/title>/,`<title>${escape(social.title)}</title>`);
    html = setMeta(html,'name','description',social.description);
    html = setMeta(html,'property','og:title',social.title);
    html = setMeta(html,'property','og:description',social.description);
    html = setMeta(html,'property','og:url',`https://www.polacywbelgii.eu/?lang=${language}`);
    html = setMeta(html,'property','og:locale',social.locale);
    html = setMeta(html,'name','twitter:title',social.title);
    html = setMeta(html,'name','twitter:description',social.description);
  }
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
