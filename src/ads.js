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
  const hasContact = ad => Boolean(safePhone(ad.publicPhone) || safeEmail(ad.publicEmail) || ad.contact);
  const detail = document.createElement('dialog'); detail.className = 'listing-detail'; detail.setAttribute('aria-label', 'Ogłoszenie'); document.body.append(detail);
  function showDetail(ad, trigger) {
    const lang = document.documentElement.lang;
    detail.setAttribute('aria-label', t('sponsored'));
    const close = element('button', { pl: 'Zamknij', en: 'Close', fr: 'Fermer', nl: 'Sluiten' }[lang] || 'Zamknij', 'button'); close.type = 'button'; close.onclick = () => detail.close();
    detail.replaceChildren(element('h2', ad.title || t('sponsored')), element('p', ad.description, 'listing-copy'));
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
    addDetailContact(names.website,safeUrl(ad.url) ? ad.url : '',safeUrl(ad.url));
    addDetailContact(names.other,ad.contact,'');
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
    const url = safeUrl(ad.url);
    const link = element(url ? 'a' : hasContact(ad) ? 'button' : 'div', '', url || hasContact(ad) ? '' : 'ad-static');
    if (link.tagName === 'BUTTON') { link.type = 'button'; link.onclick = () => showDetail(ad, link); }
    else if (url) { link.href = url; link.rel = 'sponsored noopener noreferrer'; link.target = '_blank'; }
    link.append(window.buildAdCreative(ad));
    if (ad.image) link.append(element('small', `${ad.isDemo ? 'DEMO' : t('sponsored')}${ad.company ? ` · ${ad.company}` : ''}`), element('h3', ad.title), element('p', ad.description));
    item.append(link); return item;
  }
  function premiumCard(ad) {
    const url = safeUrl(ad.url);
    const banner = element(url ? 'a' : hasContact(ad) ? 'button' : 'div', '', `premium-banner__link${url || hasContact(ad) ? '' : ' ad-static'}`);
    if (banner.tagName === 'BUTTON') { banner.type = 'button'; banner.onclick = () => showDetail(ad, banner); }
    else if (url) { banner.href = url; banner.target = '_blank'; banner.rel = 'sponsored noopener noreferrer'; }
    const caption = element('span', ad.isDemo ? 'DEMO' : t('sponsored'), 'premium-banner__caption');
    banner.append(window.buildAdCreative(ad), caption);
    return banner;
  }
  let loadedAds = [];
  let expiryTimer;
  const isLocalPreview = ['localhost','127.0.0.1'].includes(location.hostname);
  let demoAds = null;
  async function localDemos(language) {
    if (!isLocalPreview) return [];
    if (!demoAds) {
      try { const response = await fetch('/local-demo-ads.json',{ cache:'no-store' }); demoAds = response.ok ? (await response.json()).ads || [] : []; }
      catch { demoAds = []; }
    }
    return demoAds.filter(ad => ad.language === language).map(ad => ({...ad,isDemo:true}));
  }
  function regionAds(ads, type) {
    if (document.body.dataset.page !== 'ads' || type !== 'STANDARD') return ads;
    const selected = window.portalRegion?.() || 'all';
    return selected === 'all' ? ads : [...ads.filter(ad => ad.region === selected), ...ads.filter(ad => !ad.region || ad.region === 'all')];
  }
  function renderAds() {
    for (const type of ['PREMIUM', 'TOP', 'STANDARD']) {
      const list = $(`[data-ad-list="${type}"]`);
      if (!list) continue;
      const items = regionAds(loadedAds.filter(ad => ad.type === type && (ad.isDemo || (ad.periods?.length ? ad.periods.some(period => Date.parse(period.startAt) <= Date.now() && Date.now() < Date.parse(period.endAt)) : (!ad.actualStartAt || Date.parse(ad.actualStartAt) <= Date.now()) && (!ad.actualEndAt || Date.parse(ad.actualEndAt) > Date.now())))),type);
      const signature = JSON.stringify(items);
      if (list.dataset.content !== signature) {
        list.replaceChildren(...items.map(type === 'PREMIUM' ? premiumCard : card)); list.dataset.content = signature;
        if (type === 'PREMIUM') setupPremium(list);
        if (type === 'TOP') setupTop(list);
        if (type === 'STANDARD' && document.body.dataset.page === 'ads') setupMore(list);
        if (type === 'STANDARD' && document.body.dataset.page !== 'ads') setupScroller(list, 'STANDARD');
      }
      if (type !== 'STANDARD') list.closest('section').hidden = !items.length;
      if (type === 'STANDARD') {
        if (document.body.dataset.page === 'ads') list.closest('section').hidden = !loadedAds.length;
        const empty = $('[data-region-empty="ads"]'); if (empty) empty.hidden = items.length > 0;
      }
    }
    const emptyPage = $('#ads-page-empty');
    if (emptyPage) emptyPage.hidden = loadedAds.some(ad => ad.type !== 'STANDARD') || regionAds(loadedAds.filter(ad => ad.type === 'STANDARD'),'STANDARD').length > 0;
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
    const choose = next => { show(next); startTimer(); };
    const show = next => { index = (next + cards.length) % cards.length; cards.forEach((card, i) => { card.classList.toggle('is-current', i === index); card.inert = i !== index; card.setAttribute('aria-hidden', String(i !== index)); }); dots(list, 'PREMIUM', cards.length, index, choose); };
    const startTimer = () => { clearInterval(list._rotation); if (cards.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) list._rotation = setInterval(() => { if (!document.hidden && !(matchMedia('(hover: hover)').matches && cards[index].matches(':hover')) && !cards[index].contains(document.activeElement) && !detail.open) show(index + 1); }, 5000); };
    show(0);
    startTimer();
  }
  function setupTop(list) {
    if (list.children.length < 2) { clearInterval(list._rotation); list.parentElement.querySelector('.ad-dots')?.remove(); return; }
    list.classList.add('top-carousel');
    setupScroller(list, 'TOP');
  }
  function setupScroller(list, label) {
    clearInterval(list._rotation);
    let index = 0;
    const step = () => list.children.length > 1 ? list.children[1].offsetLeft - list.children[0].offsetLeft : list.clientWidth;
    const count = () => Math.max(1, Math.round((list.scrollWidth - list.clientWidth) / step()) + 1);
    const move = (next, instant = false) => { index = Math.max(0,Math.min(next,count()-1)); list.scrollTo({ left: index * step(), behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); update(); };
    const choose = selected => { move(selected); startTimer(); };
    const update = () => dots(list, label, count(), index, choose);
    list.onscroll = () => { clearTimeout(list._dotsTimer); list._dotsTimer = setTimeout(() => { index = Math.min(count()-1,Math.round(list.scrollLeft / step())); update(); }, 550); };
    list.onkeydown = event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move((index + (event.key === 'ArrowRight' ? 1 : -1) + count()) % count(),true); } };
    if (list._resize) window.removeEventListener('resize',list._resize);
    list._resize = () => { index = Math.min(index,count()-1); list.scrollTo({left:index*step(),behavior:'instant'}); update(); };
    window.addEventListener('resize',list._resize);
    update();
    const startTimer = () => { clearInterval(list._rotation); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) list._rotation = setInterval(() => { if (!document.hidden && !(matchMedia('(hover: hover)').matches && list.matches(':hover')) && !list.contains(document.activeElement) && !detail.open && count() > 1) move((index + 1) % count()); }, 5000); };
    startTimer();
  }
  function setupMore(list) {
    list.parentElement.querySelector('.ad-show-more')?.remove();
    if (list.children.length <= 8) return;
    let expanded = false;
    const button = element('button', '', 'button ad-show-more'); button.type = 'button';
    const update = () => { [...list.children].forEach((card, i) => { card.hidden = !expanded && i >= 8; }); button.textContent = expanded ? ({ pl: 'Pokaż mniej', en: 'Show less', nl: 'Minder tonen', fr: 'Afficher moins' }[document.documentElement.lang] || 'Pokaż mniej') : ({ pl: 'Pokaż więcej', en: 'Show more', nl: 'Meer tonen', fr: 'Afficher plus' }[document.documentElement.lang] || 'Pokaż więcej'); };
    button.onclick = () => { expanded = !expanded; update(); }; list.after(button); update();
  }
  let publicVersion = 0;
  async function loadAds(clear = false) {
    if (!$('#listing-top')) return;
    const version = ++publicVersion;
    if (clear) for (const id of ['#listing-premium', '#listing-top', '#ogloszenia']) { const section = $(id); if (!section) continue; section.hidden = id !== '#ogloszenia'; const list = section.querySelector('[data-ad-list]'); list.replaceChildren(); delete list.dataset.content; }
    try {
      const { ads } = await api('public', { language: document.documentElement.lang });
      if (version !== publicVersion) return;
      loadedAds = ads.length ? ads : await localDemos(document.documentElement.lang);
      renderAds();
    } catch { if (isLocalPreview) { loadedAds = await localDemos(document.documentElement.lang); renderAds(); } }
  }
  loadAds();
  setInterval(() => loadAds(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAds(); });

  document.addEventListener('languagechange', () => loadAds(true));
  document.addEventListener('portal-region-change', renderAds);
})();
