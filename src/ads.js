(() => {
  const $ = selector => document.querySelector(selector);
  const t = key => window.adTranslations[document.documentElement.lang]?.[`ads.${key}`] || window.adTranslations.pl[`ads.${key}`] || key;
  async function api(action, params = {}, body) {
    let response;
    try { response = await fetch(`/api/ads?${new URLSearchParams({ action, ...params })}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); } catch { throw { code: 'unavailable' }; }
    let data; try { data = await response.json(); } catch { throw { code: 'unavailable' }; }
    if (!response.ok) throw { code: data.error, details: data.details };
    return data;
  }
  function element(tag, value, className) { const node = document.createElement(tag); if (value) node.textContent = value; if (className) node.className = className; return node; }
  const safeUrl = value => { try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
  const safePhone = value => typeof value === 'string' && /^\+?[0-9][0-9 ().-]*$/.test(value) && (value.match(/\d/g) || []).length >= 6 ? value.replace(/(?!^)\+|[^+\d]/g,'') : '';
  const safeEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '';
  const labels = { pl:{phone:'Telefon',email:'E-mail',website:'Strona internetowa',other:'Kontakt'},nl:{phone:'Telefoon',email:'E-mail',website:'Website',other:'Contact'},fr:{phone:'Téléphone',email:'E-mail',website:'Site internet',other:'Contact'},en:{phone:'Phone',email:'Email',website:'Website',other:'Contact'} };
  const topActions = { pl:{details:'Zobacz ogłoszenie',website:'Otwórz stronę reklamodawcy'},nl:{details:'Bekijk de advertentie',website:'Open de website van de adverteerder'},fr:{details:'Voir l’annonce',website:'Ouvrir le site de l’annonceur'},en:{details:'View listing',website:'Open advertiser website'} };
  const hasContact = ad => Boolean(safePhone(ad.publicPhone) || safeEmail(ad.publicEmail) || ad.contact);
  const detail = document.createElement('dialog'); detail.className = 'listing-detail'; detail.setAttribute('aria-label', 'Ogłoszenie'); document.body.append(detail);
  function showDetail(ad, trigger) {
    const lang = document.documentElement.lang;
    detail.setAttribute('aria-label', t('sponsored'));
    const close = element('button', { pl: 'Zamknij', en: 'Close', fr: 'Fermer', nl: 'Sluiten' }[lang] || 'Zamknij', 'button'); close.type = 'button'; close.onclick = () => detail.close();
    detail.replaceChildren(element('h2', ad.title || t('sponsored')));
    if (ad.type === 'TOP' && ad.image) { const image = element('img', '', 'listing-detail__image'); image.src = ad.image; image.alt = ad.title || ad.company || ''; detail.append(image); }
    detail.append(element('p', ad.description, 'listing-copy'));
    if (ad.company) detail.append(element('p', ad.company, 'listing-company'));
    const addDetailContact = (label, value, href) => {
      if (!value) return;
      const row = element('p', '', 'listing-contact'); row.append(element('strong', `${label}: `));
      if (href) { const link = element('a', value); link.href = href; if (href.startsWith('http')) { link.target = '_blank'; link.rel = 'noopener noreferrer sponsored'; } row.append(link); }
      else row.append(document.createTextNode(value));
      detail.append(row);
    };
    const names = labels[lang] || labels.pl;
    addDetailContact(names.phone,ad.publicPhone,safePhone(ad.publicPhone) ? `tel:${safePhone(ad.publicPhone)}` : '');
    addDetailContact(names.email,ad.publicEmail,safeEmail(ad.publicEmail) ? `mailto:${safeEmail(ad.publicEmail)}` : '');
    if (ad.type !== 'TOP') addDetailContact(names.website,safeUrl(ad.url) ? ad.url : '',safeUrl(ad.url));
    addDetailContact(names.other,ad.contact,'');
    if (ad.type === 'TOP' && safeUrl(ad.url)) { const website = element('a', (topActions[lang] || topActions.pl).website, 'button listing-detail__website'); website.href = safeUrl(ad.url); website.target = '_blank'; website.rel = 'sponsored noopener noreferrer'; detail.append(website); }
    detail.append(close);
    detail.onclose = () => trigger.focus(); detail.showModal(); close.focus();
  }
  function card(ad) {
    const item = element('article', '', 'listing-card');
    if (ad.isDemo && ad.type !== 'STANDARD') item.append(element('strong','DEMO','demo-ad-label'));
    if (ad.kind === 'text' && ad.type === 'STANDARD') {
      item.classList.add('listing-card--text');
      const more = element('button', { pl: 'Czytaj całość', en: 'Read more', fr: 'Lire la suite', nl: 'Lees meer' }[document.documentElement.lang] || 'Czytaj całość', 'listing-more'); more.type = 'button'; more.onclick = () => showDetail(ad, more);
      item.append(element('small', ad.isDemo ? 'DEMO' : t('sponsored')), element('h3', ad.title || ad.company), element('p', ad.description, 'listing-copy'));
      if (ad.company) item.append(element('p', ad.company, 'listing-company'));
      const publicContact = [ad.publicPhone,ad.publicEmail,ad.contact].filter(Boolean).join(' · ');
      if (publicContact) item.append(element('p', publicContact, 'listing-contact'));
      item.append(more); return item;
    }
    if (ad.type === 'TOP') {
      const button = element('button', '', 'listing-top-card__open'); button.type = 'button'; button.onclick = () => showDetail(ad, button);
      if (ad.image) { const visual = element('div', '', 'listing-top-card__visual'); visual.append(window.buildAdCreative(ad)); button.append(visual); }
      button.append(element('h3', ad.title || ad.company, 'listing-top-card__title'), element('p', ad.description, 'listing-top-card__description'), element('span', (topActions[document.documentElement.lang] || topActions.pl).details, 'listing-top-card__cta'));
      item.append(button); return item;
    }
    const url = safeUrl(ad.url);
    const link = element(url ? 'a' : hasContact(ad) ? 'button' : 'div', '', url || hasContact(ad) ? '' : 'ad-static');
    if (link.tagName === 'BUTTON') { link.type = 'button'; link.onclick = () => showDetail(ad, link); }
    else if (url) { link.href = url; link.rel = 'sponsored noopener noreferrer'; link.target = '_blank'; }
    link.append(window.buildAdCreative(ad));
    if (ad.image) link.append(element('small', ad.isDemo ? 'DEMO' : t('sponsored')));
    item.append(link); return item;
  }
  function premiumCard(ad) {
    const url = safeUrl(ad.url);
    const banner = element(url ? 'a' : hasContact(ad) ? 'button' : 'div', '', `premium-banner__link${url || hasContact(ad) ? '' : ' ad-static'}`);
    if (banner.tagName === 'BUTTON') { banner.type = 'button'; banner.onclick = () => showDetail(ad, banner); }
    else if (url) { banner.href = url; banner.target = '_blank'; banner.rel = 'sponsored noopener noreferrer'; }
    banner.append(window.buildAdCreative(ad));
    return banner;
  }
  const placeholderCopy = {
    pl: { title: 'Tu może być Twoja reklama', description: 'Zaprezentuj swoją ofertę Polakom w Belgii.', action: 'Zamów ogłoszenie' },
    nl: { title: 'Hier kan jouw advertentie staan', description: 'Laat jouw aanbod zien aan Polen in België.', action: 'Plaats een advertentie' },
    fr: { title: 'Votre publicité pourrait être ici', description: 'Présentez votre offre aux Polonais de Belgique.', action: 'Commander une annonce' },
    en: { title: 'Your ad could be here', description: 'Show your offer to Poles in Belgium.', action: 'Place an ad' }
  };
  let displaySettings = {
    STANDARD:{visible:5,seconds:5}, TOP:{visible:2,seconds:5},
    PREMIUM:{maxItems:2,seconds:5,placeholder:{enabled:true,locales:{}}}
  };
  function placeholderCard(type) {
    const language = document.documentElement.lang;
    const copy = type === 'PREMIUM' ? displaySettings.PREMIUM.placeholder.locales[language] || displaySettings.PREMIUM.placeholder.locales.pl || placeholderCopy[language] || placeholderCopy.pl : placeholderCopy[language] || placeholderCopy.pl;
    const item = element(type === 'PREMIUM' ? 'div' : 'article', '', type === 'PREMIUM' ? 'premium-banner__link ad-placeholder ad-placeholder--premium' : `listing-card ad-placeholder ad-placeholder--${type.toLowerCase()}`);
    const content = element('div', '', 'ad-placeholder__content');
    const action = element('a', copy.action || placeholderCopy[language]?.action || placeholderCopy.pl.action, 'ad-placeholder__action');
    action.href = '/zamow-ogloszenie/';
    content.append(element('h3', copy.title), element('p', copy.description), action);
    if (type === 'PREMIUM') {
      const body = element('div', '', 'ad-placeholder__body');
      body.append(content);
      if (copy.image && /^\/images\/[a-zA-Z0-9/_-]+\.(?:svg|png|jpe?g|webp|avif)$/.test(copy.image)) {
        const image = element('img', '', 'ad-placeholder__image'); image.src = copy.image; image.alt = ''; body.append(image);
      }
      item.append(body);
    } else item.append(content);
    return item;
  }
  let loadedAds = [];
  let expiryTimer;
  function regionAds(ads, type) {
    if (document.body.dataset.page !== 'ads' || type !== 'STANDARD') return ads;
    const selected = window.portalRegion?.() || 'all';
    return selected === 'all' ? ads : [...ads.filter(ad => ad.region === selected), ...ads.filter(ad => !ad.region || ad.region === 'all')];
  }
  function renderAds() {
    for (const type of ['PREMIUM', 'TOP', 'STANDARD']) {
      const list = $(`[data-ad-list="${type}"]`);
      if (!list) continue;
      const eligible = regionAds(loadedAds.filter(ad => ad.type === type && (ad.isDemo || (ad.periods?.length ? ad.periods.some(period => Date.parse(period.startAt) <= Date.now() && Date.now() < Date.parse(period.endAt)) : (!ad.actualStartAt || Date.parse(ad.actualStartAt) <= Date.now()) && (!ad.actualEndAt || Date.parse(ad.actualEndAt) > Date.now())))),type);
      const items = type === 'PREMIUM' ? eligible.slice(0,displaySettings.PREMIUM.maxItems) : eligible;
      const signature = JSON.stringify([document.documentElement.lang, items, displaySettings[type]]);
      if (list.dataset.content !== signature) {
        const cards = items.map(type === 'PREMIUM' ? premiumCard : card);
        if (type === 'PREMIUM' && displaySettings.PREMIUM.placeholder.enabled || type !== 'PREMIUM' && !cards.length) cards.push(placeholderCard(type));
        if (type === 'PREMIUM' && !cards.length) cards.push(element('div','Brak aktywnych reklam PREMIUM.','premium-banner__link ad-empty'));
        list.replaceChildren(...cards); list.dataset.content = signature;
        if (type !== 'PREMIUM') list.style.setProperty('--ad-visible',String(Math.max(1,Math.min(displaySettings[type].visible,cards.length))));
        list.closest('section').hidden = false;
        if (type === 'PREMIUM') setupPremium(list);
        if (type === 'TOP') setupTop(list);
        if (type === 'STANDARD') { list.classList.add('standard-carousel'); setupScroller(list, 'STANDARD'); }
      }
      if (type !== 'STANDARD') list.closest('section').hidden = false;
      if (type === 'STANDARD') {
        if (document.body.dataset.page === 'ads') list.closest('section').hidden = false;
        const empty = $('[data-region-empty="ads"]'); if (empty) empty.hidden = true;
      }
    }
    const emptyPage = $('#ads-page-empty');
    if (emptyPage) emptyPage.hidden = true;
    clearTimeout(expiryTimer);
    const nearest = loadedAds.flatMap(ad => ad.periods?.length ? ad.periods.flatMap(period => [period.startAt,period.endAt]) : [ad.actualStartAt,ad.actualEndAt]).filter(value => value && Date.parse(value) > Date.now()).reduce((value, date) => Math.min(value, Date.parse(date)), Infinity);
    if (Number.isFinite(nearest)) expiryTimer = setTimeout(() => { renderAds(); loadAds(); }, Math.max(1, Math.min(nearest - Date.now(), 2147483647)));
  }
  function dots(list, label, count, current, choose) {
    let row = list.parentElement.querySelector('.ad-dots');
    if (count < 2) { row?.remove(); return; }
    if (!row) { row = element('div', '', 'ad-dots'); row.setAttribute('role', 'group'); list.after(row); }
    row.setAttribute('aria-label', `${label} – ${current + 1}/${count}`);
    const first = Math.max(0, Math.min(current - 2, count - 5));
    const visible = Math.min(count,5);
    while (row.children.length > visible) row.lastElementChild.remove();
    while (row.children.length < visible) { const button = element('button'); button.type = 'button'; row.append(button); }
    for (let position = 0; position < visible; position++) {
      const index = first + position, button = row.children[position];
      button.classList.toggle('is-active',index === current); button.setAttribute('aria-label', `${label}: ${index + 1}/${count}`); button.setAttribute('aria-current', index === current ? 'true' : 'false'); button.onclick = () => choose(index);
    }
  }
  function setupPremium(list) {
    clearInterval(list._rotation);
    const cards = [...list.children]; if (!cards.length) { list.parentElement.querySelector('.ad-dots')?.remove(); return; }
    list.classList.add('premium-rotation');
    list.classList.toggle('premium-rotation--dense',cards.some(card => card.querySelector('.ad-creative--dense')));
    let index = 0;
    let manualPause = false;
    const choose = next => { manualPause = true; clearInterval(list._rotation); list._rotation = null; show(next); };
    const show = next => { index = (next + cards.length) % cards.length; cards.forEach((card, i) => { card.classList.toggle('is-current', i === index); card.inert = i !== index; card.setAttribute('aria-hidden', String(i !== index)); }); dots(list, 'PREMIUM', cards.length, index, choose); };
    const startTimer = () => { clearInterval(list._rotation); if (!manualPause && cards.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) list._rotation = setInterval(() => { if (!document.hidden && !(matchMedia('(hover: hover)').matches && cards[index].matches(':hover')) && !cards[index].contains(document.activeElement) && !detail.open) show(index + 1); }, displaySettings.PREMIUM.seconds * 1000); };
    show(0);
    startTimer();
  }
  function setupTop(list) {
    list.classList.add('top-carousel');
    if (list.children.length < 2) { clearInterval(list._rotation); list.parentElement.querySelector('.ad-dots')?.remove(); return; }
    setupScroller(list, 'TOP');
  }
  function setupScroller(list, label) {
    clearInterval(list._rotation);
    let index = 0;
    let manualPause = false;
    const step = () => list.children.length > 1 ? Math.max(1,list.children[1].offsetLeft - list.children[0].offsetLeft) : Math.max(1,list.clientWidth);
    const count = () => Math.max(1, Math.round((list.scrollWidth - list.clientWidth) / step()) + 1);
    const move = (next, instant = false) => { index = Math.max(0,Math.min(next,count()-1)); list.scrollTo({ left: index * step(), behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); update(); };
    const choose = selected => { manualPause = true; clearInterval(list._rotation); list._rotation = null; move(selected); };
    const update = () => dots(list, label, count(), index, choose);
    list.onscroll = () => { clearTimeout(list._dotsTimer); list._dotsTimer = setTimeout(() => { index = Math.min(count()-1,Math.round(list.scrollLeft / step())); update(); }, 550); };
    list.onkeydown = event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); manualPause = true; clearInterval(list._rotation); list._rotation = null; move((index + (event.key === 'ArrowRight' ? 1 : -1) + count()) % count(),true); } };
    list.onpointerdown = () => { manualPause = true; clearInterval(list._rotation); list._rotation = null; };
    if (list._resize) window.removeEventListener('resize',list._resize);
    list._resize = () => { index = Math.min(index,count()-1); list.scrollTo({left:index*step(),behavior:'instant'}); update(); };
    window.addEventListener('resize',list._resize);
    update();
    const startTimer = () => { clearInterval(list._rotation); if (!manualPause && count() > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) list._rotation = setInterval(() => { if (!document.hidden && !(matchMedia('(hover: hover)').matches && list.matches(':hover')) && !list.contains(document.activeElement) && !detail.open && count() > 1) move((index + 1) % count()); }, displaySettings[label].seconds * 1000); };
    startTimer();
  }
  let publicVersion = 0;
  async function loadAds(clear = false) {
    if (!$('#listing-top')) return;
    const version = ++publicVersion;
    if (clear) for (const id of ['#listing-premium', '#listing-top', '#ogloszenia']) { const section = $(id); if (!section) continue; section.hidden = id !== '#ogloszenia'; const list = section.querySelector('[data-ad-list]'); list.replaceChildren(); delete list.dataset.content; }
    try {
      const { ads, display } = await api('public', { language: document.documentElement.lang });
      if (version !== publicVersion) return;
      loadedAds = ads;
      if (display) displaySettings = display;
      renderAds();
    } catch { /* Keep the last verified response when the API is unavailable. */ }
  }
  loadAds();
  setInterval(() => loadAds(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAds(); });

  document.addEventListener('languagechange', () => loadAds(true));
  document.addEventListener('portal-region-change', renderAds);
})();
