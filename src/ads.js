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
  let publicVersion = 0;
  async function loadAds(clear = false) {
    if (!$('#listing-top')) return;
    const version = ++publicVersion;
    if (clear) for (const id of ['#listing-top', '#ogloszenia']) { $(id).hidden = id === '#listing-top'; const list = $(id).querySelector('[data-ad-list]'); list.replaceChildren(); delete list.dataset.content; }
    try {
      const { ads } = await api('public', { language: document.documentElement.lang });
      if (version !== publicVersion) return;
      for (const type of ['TOP', 'STANDARD']) {
        const list = $(`[data-ad-list="${type}"]`);
        const items = ads.filter(ad => ad.type === type);
        const signature = JSON.stringify(items);
        if (list.dataset.content !== signature) { list.replaceChildren(...items.map(card)); list.dataset.content = signature; }
        list.closest('section').hidden = type === 'TOP' && !items.length;
      }
    } catch { /* Keep the last loaded content during temporary connection failures. */ }
  }
  loadAds();
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = $('[data-ad-list="STANDARD"]');
  const pause = $('[data-ad-pause]');
  function pauseLabel() { if (pause) { pause.textContent = t(paused ? 'play' : 'pause'); pause.setAttribute('aria-pressed', String(paused)); } }
  if (track) {
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
    setInterval(() => {
      if (paused || document.hidden || track.matches(':hover') || track.contains(document.activeElement)) return;
      move(1);
    }, 10000);
  }
  setInterval(() => loadAds(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAds(); });

  document.addEventListener('languagechange', () => { loadAds(true); pauseLabel(); });
})();
