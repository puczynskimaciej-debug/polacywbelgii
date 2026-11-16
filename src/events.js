(() => {
  const dialog = document.querySelector('#event-calendar-dialog');
  if (!dialog) return;
  const grid = dialog.querySelector('#event-calendar-grid');
  const details = dialog.querySelector('#event-day-details');
  const title = dialog.querySelector('#event-month-title');
  const home = document.querySelector('#home-events');
  const mini = document.querySelector('#home-mini-grid');
  const calendarInfo = window.PbeCalendar;
  const copy = {
    pl:{locale:'pl-PL',days:['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'],time:'Termin',place:'Miejsce',organizer:'Organizator',source:'Strona organizatora →',empty:'Brak nadchodzących wydarzeń tego dnia.',show:'Pokaż w kalendarzu →',unavailable:'Kalendarz jest chwilowo niedostępny.',fallback:'Treść wydarzenia jest dostępna po polsku.',count:'wydarzeń'},
    en:{locale:'en-GB',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],time:'Date',place:'Place',organizer:'Organiser',source:'Organiser website →',empty:'No upcoming events on this day.',show:'Show in calendar →',unavailable:'The calendar is temporarily unavailable.',fallback:'Event details are available in Polish.',count:'events'},
    nl:{locale:'nl-BE',days:['ma','di','wo','do','vr','za','zo'],time:'Datum',place:'Plaats',organizer:'Organisator',source:'Website van organisator →',empty:'Geen komende evenementen op deze dag.',show:'Toon in kalender →',unavailable:'De kalender is tijdelijk niet beschikbaar.',fallback:'De evenementinformatie is beschikbaar in het Pools.',count:'evenementen'},
    fr:{locale:'fr-BE',days:['lun','mar','mer','jeu','ven','sam','dim'],time:'Date',place:'Lieu',organizer:'Organisateur',source:'Site de l’organisateur →',empty:'Aucun événement à venir ce jour-là.',show:'Voir dans le calendrier →',unavailable:'Le calendrier est temporairement indisponible.',fallback:'Les détails de l’événement sont disponibles en polonais.',count:'événements'}
  };
  Object.assign(copy.pl,{homeEmpty:'Brak nadchodzących wydarzeń. Sprawdź pełny kalendarz.',show:'Zobacz w kalendarzu',unknownTime:'Godzina nieustalona',untitled:'Wydarzenie bez tytułu',regions:{flanders:'Flandria',wallonia:'Walonia',brussels:'Bruksela'}});
  Object.assign(copy.en,{homeEmpty:'No upcoming events. Explore the full calendar.',show:'See in calendar',unknownTime:'Time to be confirmed',untitled:'Untitled event',regions:{flanders:'Flanders',wallonia:'Wallonia',brussels:'Brussels'}});
  Object.assign(copy.nl,{homeEmpty:'Geen aankomende evenementen. Bekijk de volledige kalender.',show:'Bekijk in kalender',unknownTime:'Tijd nog te bepalen',untitled:'Evenement zonder titel',regions:{flanders:'Vlaanderen',wallonia:'Wallonië',brussels:'Brussel'}});
  Object.assign(copy.fr,{homeEmpty:'Aucun événement à venir. Consultez le calendrier complet.',show:'Voir dans le calendrier',unknownTime:'Heure à confirmer',untitled:'Événement sans titre',regions:{flanders:'Flandre',wallonia:'Wallonie',brussels:'Bruxelles'}});
  const t = () => copy[document.documentElement.lang] || copy.pl;
  const localDay = value => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const localDateTime = value => new Intl.DateTimeFormat(t().locale,{timeZone:'Europe/Brussels',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  const today = localDay(new Date());
  let month = today.slice(0,7), selected = today, miniMonth = month, events = [], opener = null, nameDays = null;
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
  const eventTime = event => event.start ? localDateTime(event.start) : `${eventDate(event)} · ${t().unknownTime}`;
  const dateLabel = event => event.start ? new Intl.DateTimeFormat(t().locale,{timeZone:'Europe/Brussels',day:'numeric',month:'short'}).format(new Date(event.start)) : new Intl.DateTimeFormat(t().locale,{timeZone:'UTC',day:'numeric',month:'short'}).format(new Date(`${eventDate(event)}T12:00:00Z`));
  const timeLabel = event => event.start ? new Intl.DateTimeFormat(t().locale,{timeZone:'Europe/Brussels',timeStyle:'short'}).format(new Date(event.start)) : t().unknownTime;
  const node = (tag, text, className) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (className) item.className = className; return item; };
  const safeLink = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
  const holidayScope = {pl:'Dzień wolny dla pracowników właściwych instytucji publicznych; nie jest dniem wolnym dla wszystkich pracowników.',en:'A day off for the relevant public institutions, not a general day off for all workers.',nl:'Vrije dag voor de betrokken overheidsdiensten, niet voor alle werknemers.',fr:'Jour de congé pour les services publics concernés, pas pour tous les travailleurs.'};
  const holidayHeading = {pl:'Święta i dni wolne',en:'Holidays and days off',nl:'Feestdagen en vrije dagen',fr:'Jours fériés et congés'};
  const sourceLabel = {pl:'Źródło',en:'Source',nl:'Bron',fr:'Source'};
  const moreLabel = {pl:'Zobacz więcej wydarzeń',en:'See more events',nl:'Meer evenementen bekijken',fr:'Voir plus d’événements'};
  const fullLabel = {pl:'Otwórz pełny kalendarz',en:'Open full calendar',nl:'Volledige kalender openen',fr:'Ouvrir le calendrier complet'};
  const dateEvents = date => events.filter(event => !event.isHoliday && visible(event) && upcoming(event) && onDay(event,date));
  const manualHolidayOn = date => events.some(event => event.isHoliday && visible(event) && onDay(event,date));
  function appendHolidayInfo(container, date) {
    const holidays = calendarInfo?.holidays(date,region) || [];
    const manual = events.filter(event => event.isHoliday && visible(event) && onDay(event,date));
    const filtered = holidays.filter(holiday => !manual.some(event => event.region === holiday.region || event.region === 'all'));
    if (filtered.length || manual.length) {
      const section = node('section',undefined,'event-holidays'); section.append(node('h4',holidayHeading[document.documentElement.lang] || holidayHeading.pl));
      for (const holiday of filtered) {
        const scope = holiday.scope === 'federal' ? ({pl:'Cała Belgia · ustawowy dzień wolny od pracy',en:'All Belgium · statutory public holiday',nl:'Heel België · wettelijke feestdag',fr:'Toute la Belgique · jour férié légal'})[document.documentElement.lang] : ({pl:'Dzień instytucji publicznych w regionie',en:'Day for regional public institutions',nl:'Dag voor regionale overheidsdiensten',fr:'Jour pour les institutions publiques régionales'})[document.documentElement.lang];
        const item = node('p',`${calendarInfo.label(holiday,document.documentElement.lang)} · ${scope}`);
        if (holiday.scope === 'institutional') item.append(node('small',holidayScope[document.documentElement.lang] || holidayScope.pl));
        const link = node('a',sourceLabel[document.documentElement.lang] || sourceLabel.pl); link.href = holiday.source; link.target='_blank'; link.rel='noopener noreferrer'; item.append(' · ',link); section.append(item);
      }
      for (const event of manual) {
        const item = node('p',event.title || t().untitled); if (event.description) item.append(node('small',event.description));
        const link = safeLink(event.sourceUrl); if (link) { const source = node('a',sourceLabel[document.documentElement.lang] || sourceLabel.pl); source.href=link; source.target='_blank'; source.rel='noopener noreferrer'; item.append(' · ',source); }
        section.append(item);
      }
      container.append(section);
    }
  }

  function appendNameDays(container, date) {
    if (document.documentElement.lang !== 'pl' || !nameDays) return;
    const names = nameDays.days?.[date.slice(5)]?.names || [];
    if (names.length) container.append(node('p',`Imieniny obchodzą: ${names.join(', ')}`,'event-name-days'));
  }

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
    appendNameDays(details,selected);
    appendHolidayInfo(details,selected);
    const matches = dateEvents(selected).filter(event => !event.isHoliday).sort((a,b) => String(a.start || a.date).localeCompare(String(b.start || b.date)));
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
      const matchCount = dateEvents(date).length;
      const isHoliday = (calendarInfo?.holidays(date,region).length || 0) > 0 || calendarInfo?.sunday(date) || manualHolidayOn(date);
      const button = node('button',String(number),`event-calendar-day${matchCount ? ' has-events' : ''}${isHoliday ? ' is-holiday' : ''}${date === today ? ' is-today' : ''}${date === selected ? ' is-selected' : ''}`);
      button.type = 'button'; button.dataset.date = date; button.setAttribute('aria-label',`${number} ${title.textContent}${matchCount ? `, ${matchCount} ${t().count}` : ''}`); button.setAttribute('aria-pressed',String(date === selected));
      button.addEventListener('click',() => { selected = date; renderMonth(); renderDay(); grid.querySelector(`[data-date="${date}"]`)?.focus(); });
      grid.append(button);
    }
    renderDay();
  }

  function renderMini() {
    if (!mini) return;
    const fullButton = document.querySelector('.home-mini-full'); if (fullButton) fullButton.textContent = fullLabel[document.documentElement.lang] || fullLabel.pl;
    const first = new Date(`${miniMonth}-01T12:00:00Z`);
    document.querySelector('#home-mini-title').textContent = new Intl.DateTimeFormat(t().locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
    mini.replaceChildren();
    for (const label of t().days) mini.append(node('span',label,'event-weekday'));
    for (let i=0;i<(first.getUTCDay()+6)%7;i++) mini.append(node('span',undefined,'event-calendar-empty'));
    const count = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    for (let number=1;number<=count;number++) {
      const date = `${miniMonth}-${String(number).padStart(2,'0')}`;
      const hasEvents = dateEvents(date).length > 0;
      const isHoliday = (calendarInfo?.holidays(date).length || 0) > 0 || calendarInfo?.sunday(date) || manualHolidayOn(date);
      const button = node('button',String(number),`event-calendar-day${hasEvents ? ' has-events' : ''}${isHoliday ? ' is-holiday' : ''}${date === today ? ' is-today' : ''}`);
      button.type='button'; button.dataset.date=date; button.setAttribute('aria-label',date);
      button.addEventListener('click',() => { region='all'; selected=date; month=miniMonth; open(button); });
      mini.append(button);
    }
  }

  function renderHome() {
    if (!home) return;
    const upcomingEvents = [...new Map(events.filter(event => eventDate(event) && upcoming(event) && !event.isHoliday).map(event => [event.url,event])).values()].sort((a,b) => String(a.start || a.date).localeCompare(String(b.start || b.date))).slice(0,3);
    home.replaceChildren();
    if (!upcomingEvents.length) { const empty = node('p',t().homeEmpty,'home-events-empty'); home.append(empty); renderMini(); return; }
    for (const event of upcomingEvents) {
      const card = node('a',undefined,'event-card'); card.href='/wydarzenia/';
      const date = node('div',dateLabel(event),'event-card__date');
      const info = node('div'); info.append(node('h3',event.title || t().untitled));
      const place = event.city || t().regions[event.region]; if (place) info.append(node('p',place,'event-card__place'));
      info.append(node('p',timeLabel(event),'event-card__time'));
      if (document.documentElement.lang !== 'pl') info.append(node('small',t().fallback,'language-fallback'));
      const button = node('span',t().show,'event-card__button');
      card.addEventListener('click',click => { click.preventDefault(); region = regions.includes(event.region) ? event.region : 'all'; selected = eventDate(event); month = selected.slice(0,7); open(card); const chosen = [...details.querySelectorAll('[data-event-url]')].find(item => item.dataset.eventUrl === event.url); chosen?.click(); chosen?.scrollIntoView({block:'nearest'}); });
      info.append(button); card.append(date,info); home.append(card);
    }
    const more = node('button',moreLabel[document.documentElement.lang] || moreLabel.pl,'event-card__button'); more.type='button'; more.addEventListener('click',() => { region='all'; open(more); }); home.append(more);
    renderMini();
  }

  function open(trigger) {
    if (dialog.open) return;
    opener = trigger;
    document.body.classList.add('event-dialog-open');
    regionButtons(); renderMonth(); dialog.showModal(); dialog.querySelector('[data-event-close]').focus();
    if (document.documentElement.lang === 'pl' && !nameDays) fetch('/name-days-pl.json').then(response => response.ok ? response.json() : null).then(data => { nameDays=data; if (dialog.open) renderDay(); }).catch(() => {});
  }
  dialog.addEventListener('close',() => { document.body.classList.remove('event-dialog-open'); opener?.focus(); opener = null; });
  dialog.querySelector('[data-event-close]').addEventListener('click',() => dialog.close());
  dialog.querySelectorAll('[data-event-region]').forEach(button => button.addEventListener('click',() => { region = button.dataset.eventRegion; regionButtons(); renderMonth(); }));
  document.addEventListener('portal-open-events', event => { region = event.detail.region; open(event.detail.trigger); });
  dialog.querySelectorAll('[data-event-month]').forEach(button => button.addEventListener('click',() => { const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth()+(button.dataset.eventMonth === 'next' ? 1 : -1)); month = date.toISOString().slice(0,7); selected = `${month}-01`; renderMonth(); }));
  document.querySelectorAll('[data-mini-month]').forEach(button => button.addEventListener('click',() => { const date = new Date(`${miniMonth}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth()+(button.dataset.miniMonth === 'next' ? 1 : -1)); miniMonth=date.toISOString().slice(0,7); renderMini(); }));
  document.querySelectorAll('[data-event-open]').forEach(button => button.addEventListener('click',() => { region = 'all'; open(button); }));
  if (document.body.dataset.page === 'events') open(document.querySelector('[data-event-open]'));
  document.addEventListener('languagechange',() => { renderHome(); regionButtons(); if (dialog.open) renderMonth(); });
  fetch('/api/public-events',{cache:'no-store'}).then(response => { if (!response.ok) throw new Error('unavailable'); return response.json(); }).then(data => { events = Array.isArray(data.events) ? data.events : []; renderHome(); if (dialog.open) renderMonth(); }).catch(() => { if (home) home.append(node('p',t().unavailable)); details.replaceChildren(node('p',t().unavailable)); });
})();
