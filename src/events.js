(() => {
  const dialog = document.querySelector('#event-calendar-dialog');
  if (!dialog) return;
  const grid = dialog.querySelector('#event-calendar-grid');
  const details = dialog.querySelector('#event-day-details');
  const undated = dialog.querySelector('#event-undated');
  const title = dialog.querySelector('#event-month-title');
  const home = document.querySelector('#home-events');
  const copy = {
    pl:{locale:'pl-PL',days:['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'],time:'Termin',place:'Miejsce',organizer:'Organizator',source:'Strona organizatora →',empty:'Brak nadchodzących wydarzeń tego dnia.',show:'Pokaż w kalendarzu →',unavailable:'Kalendarz jest chwilowo niedostępny.',fallback:'Treść wydarzenia jest dostępna po polsku.',count:'wydarzeń'},
    en:{locale:'en-GB',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],time:'Date',place:'Place',organizer:'Organiser',source:'Organiser website →',empty:'No upcoming events on this day.',show:'Show in calendar →',unavailable:'The calendar is temporarily unavailable.',fallback:'Event details are available in Polish.',count:'events'},
    nl:{locale:'nl-BE',days:['ma','di','wo','do','vr','za','zo'],time:'Datum',place:'Plaats',organizer:'Organisator',source:'Website van organisator →',empty:'Geen komende evenementen op deze dag.',show:'Toon in kalender →',unavailable:'De kalender is tijdelijk niet beschikbaar.',fallback:'De evenementinformatie is beschikbaar in het Pools.',count:'evenementen'},
    fr:{locale:'fr-BE',days:['lun','mar','mer','jeu','ven','sam','dim'],time:'Date',place:'Lieu',organizer:'Organisateur',source:'Site de l’organisateur →',empty:'Aucun événement à venir ce jour-là.',show:'Voir dans le calendrier →',unavailable:'Le calendrier est temporairement indisponible.',fallback:'Les détails de l’événement sont disponibles en polonais.',count:'événements'}
  };
  Object.assign(copy.pl,{homeEmpty:'Brak nadchodzących wydarzeń. Sprawdź pełny kalendarz.',show:'Zobacz w kalendarzu',unknownTime:'Godzina nieustalona',undated:'Termin do ustalenia',undatedHeading:'Wydarzenia z nieustalonym terminem',undatedEmpty:'Brak wydarzeń z nieustalonym terminem.',untitled:'Wydarzenie bez tytułu',regions:{flanders:'Flandria',wallonia:'Walonia',brussels:'Bruksela'}});
  Object.assign(copy.en,{homeEmpty:'No upcoming events. Explore the full calendar.',show:'See in calendar',unknownTime:'Time to be confirmed',undated:'Date to be confirmed',undatedHeading:'Events without a confirmed date',undatedEmpty:'No events without a confirmed date.',untitled:'Untitled event',regions:{flanders:'Flanders',wallonia:'Wallonia',brussels:'Brussels'}});
  Object.assign(copy.nl,{homeEmpty:'Geen aankomende evenementen. Bekijk de volledige kalender.',show:'Bekijk in kalender',unknownTime:'Tijd nog te bepalen',undated:'Datum nog te bepalen',undatedHeading:'Evenementen zonder bevestigde datum',undatedEmpty:'Geen evenementen zonder bevestigde datum.',untitled:'Evenement zonder titel',regions:{flanders:'Vlaanderen',wallonia:'Wallonië',brussels:'Brussel'}});
  Object.assign(copy.fr,{homeEmpty:'Aucun événement à venir. Consultez le calendrier complet.',show:'Voir dans le calendrier',unknownTime:'Heure à confirmer',undated:'Date à confirmer',undatedHeading:'Événements sans date confirmée',undatedEmpty:'Aucun événement sans date confirmée.',untitled:'Événement sans titre',regions:{flanders:'Flandre',wallonia:'Wallonie',brussels:'Bruxelles'}});
  const t = () => copy[document.documentElement.lang] || copy.pl;
  const localDay = value => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const localDateTime = value => new Intl.DateTimeFormat(t().locale,{timeZone:'Europe/Brussels',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  const today = localDay(new Date());
  let month = today.slice(0,7), selected = today, events = [], opener = null;
  const regions = ['flanders','wallonia','brussels','all'];
  let region = regions.includes(new URLSearchParams(location.search).get('region')) && document.body.dataset.page === 'events' ? new URLSearchParams(location.search).get('region') : 'all';
  const visible = event => region === 'all' || event.region === region || event.region === 'all';
  function regionButtons() {
    const labels = { pl:['Flandria','Walonia','Bruksela','Cała Belgia'], en:['Flanders','Wallonia','Brussels','All Belgium'], nl:['Vlaanderen','Wallonië','Brussel','Heel België'], fr:['Flandre','Wallonie','Bruxelles','Toute la Belgique'] };
    dialog.querySelector('[data-event-region-controls]')?.setAttribute('aria-label', ({pl:'Region wydarzeń',en:'Event region',nl:'Regio van evenementen',fr:'Région des événements'})[document.documentElement.lang] || 'Region wydarzeń');
    dialog.querySelectorAll('[data-event-region]').forEach(button => { button.textContent = (labels[document.documentElement.lang] || labels.pl)[regions.indexOf(button.dataset.eventRegion)]; button.classList.toggle('is-active',button.dataset.eventRegion === region); button.setAttribute('aria-pressed',String(button.dataset.eventRegion === region)); });
  }
  const eventDate = event => event.date || event.start && localDay(event.start);
  const upcoming = event => !eventDate(event) || (event.end ? Date.parse(event.end) >= Date.now() : (event.endDate || eventDate(event)) >= today);
  const onDay = (event, date) => eventDate(event) && eventDate(event) <= date && (event.endDate || event.end && localDay(event.end) || eventDate(event)) >= date;
  const eventTime = event => !eventDate(event) ? t().undated : event.start ? localDateTime(event.start) : `${eventDate(event)} · ${t().unknownTime}`;
  const dateLabel = event => event.start ? new Intl.DateTimeFormat(t().locale,{timeZone:'Europe/Brussels',dateStyle:'medium'}).format(new Date(event.start)) : new Intl.DateTimeFormat(t().locale,{timeZone:'UTC',dateStyle:'medium'}).format(new Date(`${eventDate(event)}T12:00:00Z`));
  const timeLabel = event => event.start ? new Intl.DateTimeFormat(t().locale,{timeZone:'Europe/Brussels',timeStyle:'short'}).format(new Date(event.start)) : t().unknownTime;
  const node = (tag, text, className) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (className) item.className = className; return item; };
  const safeLink = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };

  function showEvent(event, container) {
    container.replaceChildren();
    container.append(node('h4',event.title || t().untitled),node('p',event.description),node('p',`${t().time}: ${eventTime(event)}${event.end ? ` – ${localDateTime(event.end)}` : ''}`));
    if (event.venue || event.city || event.address) container.append(node('p',`${t().place}: ${[event.venue,event.city,event.address].filter(Boolean).join(', ')}`));
    if (event.organizer) container.append(node('p',`${t().organizer}: ${event.organizer}`));
    if (document.documentElement.lang !== 'pl') container.append(node('p',t().fallback,'language-fallback'));
    const source = safeLink(event.sourceUrl);
    if (source) { const link = node('a',t().source,'text-link'); link.href = source; link.target = '_blank'; link.rel = 'noopener noreferrer'; container.append(link); }
  }

  function renderDay() {
    const date = new Date(`${selected}T12:00:00Z`);
    const heading = node('h3',new Intl.DateTimeFormat(t().locale,{dateStyle:'full',timeZone:'UTC'}).format(date));
    details.replaceChildren(heading);
    const matches = events.filter(event => visible(event) && upcoming(event) && onDay(event,selected)).sort((a,b) => String(a.start || a.date).localeCompare(String(b.start || b.date)));
    if (!matches.length) { details.append(node('p',t().empty)); return; }
    for (const event of matches) {
      const item = node('article',undefined,'event-day-item');
      const button = node('button',event.title || t().untitled,'event-day-event'); button.type = 'button'; button.dataset.eventUrl = event.url; button.setAttribute('aria-expanded','false');
      const content = node('div',undefined,'event-day-event-detail'); content.hidden = true;
      button.addEventListener('click',() => { const open = content.hidden; details.querySelectorAll('.event-day-event-detail').forEach(panel => { panel.hidden = true; panel.previousElementSibling.setAttribute('aria-expanded','false'); }); content.hidden = !open; button.setAttribute('aria-expanded',String(open)); if (open) showEvent(event,content); });
      item.append(button,content); details.append(item);
    }
  }

  function renderMonth() {
    const first = new Date(`${month}-01T12:00:00Z`);
    title.textContent = new Intl.DateTimeFormat(t().locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
    grid.replaceChildren();
    for (const label of t().days) grid.append(node('span',label,'event-weekday'));
    const offset = (first.getUTCDay()+6)%7;
    for (let i=0;i<offset;i++) grid.append(node('span',undefined,'event-calendar-empty'));
    const count = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    for (let number=1;number<=count;number++) {
      const date = `${month}-${String(number).padStart(2,'0')}`;
      const matchCount = events.filter(event => visible(event) && upcoming(event) && onDay(event,date)).length;
      const button = node('button',String(number),`event-calendar-day${matchCount ? ' has-events' : ''}${date === selected ? ' is-selected' : ''}`);
      button.type = 'button'; button.dataset.date = date; button.setAttribute('aria-label',`${number} ${title.textContent}${matchCount ? `, ${matchCount} ${t().count}` : ''}`); button.setAttribute('aria-pressed',String(date === selected));
      button.addEventListener('click',() => { selected = date; renderMonth(); renderDay(); grid.querySelector(`[data-date="${date}"]`)?.focus(); });
      grid.append(button);
    }
    renderDay();
    renderUndated();
  }

  function renderUndated() {
    if (!undated) return;
    undated.replaceChildren(node('h3',t().undatedHeading));
    const items = events.filter(event => visible(event) && !eventDate(event));
    if (!items.length) { undated.append(node('p',t().undatedEmpty)); return; }
    for (const event of items) {
      const item = node('article',undefined,'event-day-item'), button = node('button',event.title || t().untitled,'event-day-event'), content = node('div',undefined,'event-day-event-detail');
      button.type = 'button'; content.hidden = true; button.addEventListener('click',() => { content.hidden = !content.hidden; if (!content.hidden) showEvent(event,content); });
      item.append(button,content); undated.append(item);
    }
  }

  function renderHome() {
    if (!home) return;
    const upcomingEvents = [...new Map(events.filter(event => eventDate(event) && upcoming(event)).map(event => [event.url,event])).values()].sort((a,b) => String(a.start || a.date).localeCompare(String(b.start || b.date))).slice(0,2);
    home.replaceChildren();
    if (!upcomingEvents.length) { const empty = node('p',t().homeEmpty,'home-events-empty'); const button = node('button',t().show,'event-card__button'); button.type = 'button'; button.addEventListener('click',() => { region = 'all'; open(button); }); home.append(empty,button); return; }
    for (const event of upcomingEvents) {
      const card = node('article',undefined,'event-card');
      const date = node('div',dateLabel(event),'event-card__date');
      const info = node('div'); info.append(node('h3',event.title || t().untitled));
      const place = event.city || t().regions[event.region]; if (place) info.append(node('p',place,'event-card__place'));
      info.append(node('p',timeLabel(event),'event-card__time'));
      if (document.documentElement.lang !== 'pl') info.append(node('small',t().fallback,'language-fallback'));
      const button = node('button',t().show,'event-card__button'); button.type = 'button';
      button.addEventListener('click',() => { region = regions.includes(event.region) ? event.region : 'all'; selected = eventDate(event); month = selected.slice(0,7); open(button); const chosen = [...details.querySelectorAll('[data-event-url]')].find(item => item.dataset.eventUrl === event.url); chosen?.click(); chosen?.scrollIntoView({block:'nearest'}); });
      info.append(button); card.append(date,info); home.append(card);
    }
  }

  function open(trigger) {
    if (dialog.open) return;
    opener = trigger;
    document.body.classList.add('event-dialog-open');
    regionButtons(); renderMonth(); dialog.showModal(); dialog.querySelector('[data-event-close]').focus();
  }
  dialog.addEventListener('close',() => { document.body.classList.remove('event-dialog-open'); opener?.focus(); opener = null; });
  dialog.querySelector('[data-event-close]').addEventListener('click',() => dialog.close());
  dialog.querySelectorAll('[data-event-region]').forEach(button => button.addEventListener('click',() => { region = button.dataset.eventRegion; regionButtons(); renderMonth(); }));
  document.addEventListener('portal-open-events', event => { region = event.detail.region; open(event.detail.trigger); });
  dialog.querySelectorAll('[data-event-month]').forEach(button => button.addEventListener('click',() => { const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth()+(button.dataset.eventMonth === 'next' ? 1 : -1)); month = date.toISOString().slice(0,7); selected = `${month}-01`; renderMonth(); }));
  document.querySelectorAll('[data-event-open]').forEach(button => button.addEventListener('click',() => { region = 'all'; open(button); }));
  if (document.body.dataset.page === 'events') open(document.querySelector('[data-event-open]'));
  document.addEventListener('languagechange',() => { renderHome(); regionButtons(); if (dialog.open) renderMonth(); });
  fetch('/api/public-events',{cache:'no-store'}).then(response => { if (!response.ok) throw new Error('unavailable'); return response.json(); }).then(data => { events = Array.isArray(data.events) ? data.events : []; renderHome(); if (dialog.open) renderMonth(); }).catch(() => { if (home) home.append(node('p',t().unavailable)); details.replaceChildren(node('p',t().unavailable)); });
})();
