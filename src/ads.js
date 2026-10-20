(() => {
  const $ = selector => document.querySelector(selector);
  const t = key => window.adTranslations[document.documentElement.lang]?.[`ads.${key}`] || window.adTranslations.pl[`ads.${key}`] || key;
  async function api(action, params = {}, body) {
    let response;
    try { response = await fetch(`/.netlify/functions/ads?${new URLSearchParams({ action, ...params })}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); } catch { throw { code: 'unavailable' }; }
    let data; try { data = await response.json(); } catch { throw { code: 'unavailable' }; }
    if (!response.ok) throw { code: data.error, details: data.details };
    return data;
  }
  function element(tag, value, className) { const node = document.createElement(tag); if (value) node.textContent = value; if (className) node.className = className; return node; }
  const detail = document.createElement('dialog'); detail.className = 'listing-detail'; detail.setAttribute('aria-label', 'Ogłoszenie'); document.body.append(detail);
  function showDetail(ad, trigger) {
    const lang = document.documentElement.lang;
    const close = element('button', { pl: 'Zamknij', fr: 'Fermer', nl: 'Sluiten' }[lang] || 'Zamknij', 'button'); close.type = 'button'; close.onclick = () => detail.close();
    detail.replaceChildren(element('h2', t('sponsored')), element('p', ad.description, 'listing-copy'), element('p', ad.contact, 'listing-contact'), close);
    detail.onclose = () => trigger.focus(); detail.showModal(); close.focus();
  }
  function card(ad) {
    const item = element('article', '', 'listing-card');
    if (ad.kind === 'text') {
      item.classList.add('listing-card--text');
      const more = element('button', { pl: 'Czytaj całość', fr: 'Lire la suite', nl: 'Lees meer' }[document.documentElement.lang] || 'Czytaj całość', 'listing-more'); more.type = 'button'; more.onclick = () => showDetail(ad, more);
      item.append(element('small', t('sponsored')), element('p', ad.description, 'listing-copy'), element('p', ad.contact, 'listing-contact'), more); return item;
    }
    const link = element('a'); link.href = ad.url; link.rel = 'sponsored noopener'; link.target = '_blank';
    const image = element('img'); image.src = ad.image; image.alt = ad.company; image.loading = 'lazy';
    link.append(image, element('small', `${t('sponsored')} · ${ad.company}`), element('h3', ad.title), element('p', ad.description));
    item.append(link); return item;
  }
  function premiumCard(ad) {
    const banner = element('div', '', 'premium-banner__link');
    const picture = element('picture');
    if (ad.imageMobile) { const source = element('source'); source.media = '(max-width: 580px)'; source.srcset = ad.imageMobile; picture.append(source); }
    const image = element('img'); image.src = ad.image; image.alt = ad.company || ad.title;
    image.width = 1200; image.height = 300;
    const caption = element('span', t('sponsored'), 'premium-banner__caption');
    picture.append(image); banner.append(picture, caption);
    return banner;
  }
  let loadedAds = [];
  function regionAds(ads) {
    if (document.body.dataset.page !== 'regionalAds') return ads;
    const selected = window.portalRegion?.() || 'all';
    return selected === 'all' ? ads : [...ads.filter(ad => ad.region === selected), ...ads.filter(ad => !ad.region || ad.region === 'all')];
  }
  function renderAds() {
    for (const type of ['PREMIUM', 'TOP', 'STANDARD']) {
      const list = $(`[data-ad-list="${type}"]`);
      if (!list) continue;
      const items = regionAds(loadedAds.filter(ad => ad.type === type));
      const signature = JSON.stringify(items);
      if (list.dataset.content !== signature) { list.replaceChildren(...items.map(type === 'PREMIUM' ? premiumCard : card)); list.dataset.content = signature; }
      if (type !== 'STANDARD') list.closest('section').hidden = !items.length;
      if (type === 'STANDARD') {
        const empty = $('[data-region-empty="ads"]'); if (empty) empty.hidden = items.length > 0;
      }
    }
  }
  let publicVersion = 0;
  async function loadAds(clear = false) {
    if (!$('#listing-top')) return;
    const version = ++publicVersion;
    if (clear) for (const id of ['#listing-premium', '#listing-top', '#ogloszenia']) { const section = $(id); if (!section) continue; section.hidden = id !== '#ogloszenia'; const list = section.querySelector('[data-ad-list]'); list.replaceChildren(); delete list.dataset.content; }
    try {
      let ads;
      if (['localhost', '127.0.0.1'].includes(location.hostname)) {
        const demo = await fetch('/local-demo-ads.json', { cache: 'no-store' });
        if (demo.ok) ads = (await demo.json()).ads.filter(ad => ad.language === document.documentElement.lang);
      }
      if (!ads) ({ ads } = await api('public', { language: document.documentElement.lang }));
      if (version !== publicVersion) return;
      loadedAds = ads;
      renderAds();
    } catch { /* Keep the last loaded content during temporary connection failures. */ }
  }
  loadAds();
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = $('[data-ad-list="STANDARD"]');
  const pause = $('[data-ad-pause]');
  function pauseLabel() { if (pause) { pause.textContent = t(paused ? 'play' : 'pause'); pause.setAttribute('aria-pressed', String(paused)); } }
  if (track && pause && $('[data-ad-prev]') && $('[data-ad-next]')) {
    pauseLabel();
    pause.onclick = () => { paused = !paused; pauseLabel(); };
    const move = direction => {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const end = track.scrollWidth - track.clientWidth;
      if (end > 2) {
        track.scrollTo({ left: direction > 0 && track.scrollLeft >= end - 2 ? 0 : direction < 0 && track.scrollLeft <= 0 ? end : track.scrollLeft + direction * ((track.firstElementChild?.getBoundingClientRect().width || track.clientWidth) + 16), behavior: reduced ? 'auto' : 'smooth' });
      } else if (track.children.length > 2) {
        const oldPositions = new Map([...track.children].map(node => [node, node.getBoundingClientRect()]));
        const items = [...track.children];
        if (direction > 0) track.append(...items.slice(0, 2)); else track.prepend(...items.slice(-2));
        if (!reduced) for (const node of track.children) {
          const old = oldPositions.get(node); const current = node.getBoundingClientRect();
          node.animate([{ transform: `translate(${old.x - current.x}px, ${old.y - current.y}px)` }, { transform: 'translate(0, 0)' }], { duration: 1200, easing: 'ease-in-out' });
        }
      }
    };
    $('[data-ad-prev]').onclick = () => move(-1); $('[data-ad-next]').onclick = () => move(1);
    // Keep the same ten cards in a ring; moving a fully hidden card to the end
    // avoids a visible jump back to the beginning and does not duplicate cards.
    let previousFrame = 0, remainder = 0;
    const animate = now => {
      const elapsed = previousFrame ? Math.min(now - previousFrame, 80) : 0;
      previousFrame = now;
      const canMove = !paused && !document.hidden && !detail.open && !track.matches(':hover') && !track.contains(document.activeElement) && track.scrollWidth > track.clientWidth + 2;
      if (canMove) {
        remainder += elapsed * 0.018;
        const pixels = Math.floor(remainder); remainder -= pixels;
        if (pixels) {
          track.scrollLeft += pixels;
          const step = track.firstElementChild.getBoundingClientRect().width + 16;
          if (track.scrollLeft >= step) {
            const position = track.scrollLeft;
            track.append(track.firstElementChild);
            track.scrollLeft = position - step;
          }
        }
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  setInterval(() => loadAds(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAds(); });

  document.addEventListener('languagechange', () => { loadAds(true); pauseLabel(); });
})();
