(() => {
  const $ = selector => document.querySelector(selector);
  const t = key => window.adTranslations[document.documentElement.lang]?.[`ads.${key}`] || window.adTranslations.pl[`ads.${key}`] || key;
  const money = (cents, currency = 'EUR') => new Intl.NumberFormat(document.documentElement.lang, { style: 'currency', currency }).format(cents / 100);
  const errorText = error => `${t(`error.${error.code || 'unavailable'}`)}${error.details ? ' ' + error.details.map(day => `${day.date} (${day.used}/${day.capacity})`).join(', ') : ''}`;
  async function api(action, params = {}, body) {
    let response;
    try { response = await fetch(`/.netlify/functions/ads?${new URLSearchParams({ action, ...params })}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); } catch { throw { code: 'unavailable' }; }
    let data; try { data = await response.json(); } catch { throw { code: 'unavailable' }; }
    if (!response.ok) throw { code: data.error, details: data.details };
    return data;
  }
  function element(tag, value, className) { const node = document.createElement(tag); if (value) node.textContent = value; if (className) node.className = className; return node; }
  function card(ad) {
    const item = element('article', '', 'ad-card');
    const link = element('a'); link.href = ad.url; link.rel = 'sponsored noopener'; link.target = '_blank';
    const image = element('img'); image.src = ad.image; image.alt = ad.company; image.loading = 'lazy';
    link.append(image, element('small', `${t('sponsored')} · ${ad.company}`), element('h3', ad.title), element('p', ad.description));
    item.append(link); return item;
  }
  let publicVersion = 0;
  async function loadAds(clear = false) {
    if (!$('#ads-top')) return;
    const version = ++publicVersion;
    if (clear) for (const id of ['#ads-top', '#ads-standard']) { $(id).hidden = true; $(id).querySelector('[data-ad-list]').replaceChildren(); }
    try {
      const { ads } = await api('public', { language: document.documentElement.lang });
      if (version !== publicVersion) return;
      for (const type of ['TOP', 'STANDARD']) {
        const list = $(`[data-ad-list="${type}"]`);
        const items = ads.filter(ad => ad.type === type);
        list.replaceChildren(...items.map(card)); list.closest('section').hidden = !items.length;
      }
    } catch { if (version === publicVersion) for (const id of ['#ads-top', '#ads-standard']) $(id).hidden = true; }
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
        track.scrollTo({ left: direction > 0 && track.scrollLeft >= end - 2 ? 0 : direction < 0 && track.scrollLeft <= 0 ? end : track.scrollLeft + direction * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
      } else if (track.children.length > 2) {
        const oldPositions = new Map([...track.children].map(node => [node, node.getBoundingClientRect()]));
        const items = [...track.children];
        if (direction > 0) track.append(...items.slice(0, 2)); else track.prepend(...items.slice(-2));
        if (!reduced) for (const node of track.children) {
          const old = oldPositions.get(node); const current = node.getBoundingClientRect();
          node.animate([{ transform: `translate(${old.x - current.x}px, ${old.y - current.y}px)` }, { transform: 'translate(0, 0)' }], { duration: 650, easing: 'ease-in-out' });
        }
      }
    };
    $('[data-ad-prev]').onclick = () => move(-1); $('[data-ad-next]').onclick = () => move(1);
    setInterval(() => {
      if (paused || document.hidden || track.matches(':hover') || track.contains(document.activeElement)) return;
      move(1);
    }, 6000);
  }
  setInterval(() => loadAds(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAds(); });

  const form = $('#ad-order-form');
  let config, quote, quoteVersion = 0, calendarVersion = 0, nextIsEnd = false, submission, completedId, requestId = crypto.randomUUID();
  const message = text => { if ($('#ad-message')) $('#ad-message').textContent = text; };
  const field = name => form.elements.namedItem(name);
  const selection = () => Object.fromEntries(['language', 'type', 'startDate', 'endDate'].map(name => [name, field(name).value]));
  const priceText = price => `${price.days} ${t('days')} × ${money(price.dailyPrice, price.currency)} — ${t('total')}: ${money(price.totalPrice, price.currency)}`;
  function renderSummary() {
    const container = $('#ad-summary-content'); container.replaceChildren(card(submission));
    for (const value of [`${submission.language.toUpperCase()} · ${submission.type}`, `${submission.startDate} — ${submission.endDate}`, priceText(quote), submission.customerName, submission.email, submission.phone]) container.append(element('p', value));
  }
  async function refreshQuote() {
    const version = ++quoteVersion; quote = null; $('#ad-review').disabled = true; $('#ad-price').textContent = t('loading');
    try {
      const data = await api('availability', selection());
      if (version !== quoteVersion) return;
      $('#ad-price').textContent = priceText(data);
      const blocked = data.daysAvailable.filter(day => day.remaining === 0);
      if (blocked.length) throw { code: 'full', details: blocked };
      quote = data; $('#ad-review').disabled = false; message('');
    } catch (error) { if (version === quoteVersion) { $('#ad-price').textContent = ''; message(errorText(error)); } }
  }
  async function refreshCalendar() {
    const version = ++calendarVersion;
    const calendar = $('#ad-calendar'); calendar.replaceChildren();
    const month = $('#ad-month').value;
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const startDate = month + '-01';
    const endDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
    if (endDate < config.today) return;
    try {
      const result = await api('availability', { ...selection(), startDate: startDate < config.today ? config.today : startDate, endDate });
      if (version !== calendarVersion) return;
      const locale = window.siteLanguages[document.documentElement.lang].locale;
      for (let i = 0; i < 7; i++) calendar.append(element('small', new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 5 + i)))));
      const offset = (new Date(startDate).getUTCDay() + 6) % 7;
      for (let i = 0; i < offset; i++) calendar.append(element('span'));
      const lookup = new Map(result.daysAvailable.map(day => [day.date, day]));
      for (let n = 1; n <= Number(endDate.slice(-2)); n++) {
        const date = `${month}-${String(n).padStart(2, '0')}`;
        const day = lookup.get(date); const remaining = day?.remaining || 0;
        const button = element('button', `${n} · ${remaining}`, 'ad-day'); button.type = 'button'; button.disabled = !remaining;
        button.classList.toggle('ad-day-low', remaining > 0 && remaining <= 2);
        button.classList.toggle('ad-day-selected', date >= field('startDate').value && date <= field('endDate').value);
        button.setAttribute('aria-label', `${date}: ${remaining}/${day?.capacity || config.data.types[field('type').value].capacity}`);
        button.setAttribute('aria-pressed', String(date >= field('startDate').value && date <= field('endDate').value));
        button.onclick = () => {
          if (!nextIsEnd || date < field('startDate').value) { field('startDate').value = date; field('endDate').value = date; nextIsEnd = true; }
          else { field('endDate').value = date; nextIsEnd = false; }
          refreshQuote(); refreshCalendar();
        };
        calendar.append(button);
      }
    } catch (error) { if (version === calendarVersion) calendar.textContent = errorText(error); }
  }
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || file.size > 512000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return reject({ code: 'image' });
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject({ code: 'image' }); reader.readAsDataURL(file);
    });
  }
  async function initializeForm() {
    if (!form) return;
    try {
      config = await api('config');
      field('language').value = document.documentElement.lang;
      field('startDate').min = field('endDate').min = config.today;
      field('startDate').value = field('endDate').value = config.today;
      $('#ad-month').value = config.today.slice(0, 7); $('#ad-month').min = config.today.slice(0, 7);
      $('#ad-fields').disabled = false;
      refreshQuote(); refreshCalendar();
    } catch (error) { message(errorText(error)); }
  }
  if (form) {
    for (const name of ['language', 'type', 'startDate', 'endDate']) field(name).addEventListener('change', () => { refreshQuote(); refreshCalendar(); });
    $('#ad-month').onchange = refreshCalendar;
    for (const [id, delta] of [['#ad-month-prev', -1], ['#ad-month-next', 1]]) $(id).onclick = () => { const date = new Date($('#ad-month').value + '-01'); date.setUTCMonth(date.getUTCMonth() + delta); $('#ad-month').value = date.toISOString().slice(0, 7); refreshCalendar(); };
    form.onsubmit = async event => {
      event.preventDefault(); if (!quote || !form.reportValidity()) return;
      $('#ad-review').disabled = true;
      try {
        const image = await readImage(field('imageFile').files[0]);
        submission = { ...Object.fromEntries(new FormData(form)), image, imageFile: undefined, consent: field('consent').checked, requestId, expectedDailyPrice: quote.dailyPrice, expectedTotalPrice: quote.totalPrice };
        renderSummary();
        form.hidden = true; $('#ad-summary').hidden = false; message(''); $('#ad-send').focus();
      } catch (error) { message(errorText(error)); } finally { $('#ad-review').disabled = !quote; }
    };
    $('#ad-back').onclick = () => { form.hidden = false; $('#ad-summary').hidden = true; requestId = crypto.randomUUID(); refreshQuote(); };
    $('#ad-send').onclick = async () => {
      $('#ad-send').disabled = $('#ad-back').disabled = true;
      try {
        const order = await api('order', {}, submission);
        completedId = order.id; $('#ad-summary').hidden = true; message(`${t('success')} ${order.id}`);
      } catch (error) {
        message(errorText(error));
        if (['priceChanged', 'full', 'disabled'].includes(error.code)) { form.hidden = false; $('#ad-summary').hidden = true; refreshQuote(); refreshCalendar(); }
      } finally { $('#ad-send').disabled = $('#ad-back').disabled = false; }
    };
    initializeForm();
  }
  document.addEventListener('languagechange', () => {
    loadAds(true); pauseLabel();
    if (form && config && !form.hidden) { field('language').value = document.documentElement.lang; refreshQuote(); refreshCalendar(); }
    if (form && !$('#ad-summary').hidden) renderSummary();
    if (completedId) message(`${t('success')} ${completedId}`);
  });
})();
