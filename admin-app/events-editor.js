import { cmsRequest } from './modules/client.js';
import { escapeHtml, confirmAction } from './ui.js';
import { applyEventLanguage, eventText } from './cms-event-i18n.js';
import { setupTranslations } from './cms-translation.js';

const $ = selector => document.querySelector(selector);
const eventTranslations = setupTranslations($('#event-editor-form'), 'event');
document.querySelectorAll('[data-event-language-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-event-language-tab]').forEach(tab => tab.classList.toggle('is-active', tab === button));
  document.querySelectorAll('[data-event-language-pane]').forEach(pane => pane.classList.toggle('is-active', pane.dataset.eventLanguagePane === button.dataset.eventLanguageTab));
}));
let rows = [], selected = null;
let calendarMonth = new Date(); calendarMonth.setDate(1);
const notice = message => { $('#events-editor-notice').textContent = message; };
const statusName = { draft:'Szkic', pending_review:'Do zatwierdzenia', changes_requested:'Poprawki', approved:'Zaakceptowane', scheduled:'Zaplanowane', published:'Opublikowane', rejected:'Odrzucone', archived:'Wycofane' };
const statusLabel = status => eventText(status) || statusName[status] || status;
const label = (key, polish) => eventText(key) || polish;
const categoryLabel = value => label(`eventCategory${['History','Music'].includes(value) ? 'Inne' : value}`, ['History','Music'].includes(value) ? 'Inne' : value || 'Inne');
const local = value => value ? new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(' ','T') : '';
const displayDate = value => String(value || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1');
const displayDateTime = value => new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Brussels',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
function toUtc(value) {
  if (!value) return null;
  const base = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(base)) throw new Error(label('invalidTime','Nieprawidłowy termin.'));
  const matches = [1,2].map(hours => new Date(base-hours*3600000)).filter(date => local(date) === value);
  if (matches.length !== 1) throw new Error(matches.length ? label('timeFold','Ta godzina występuje dwa razy. Wybierz inną godzinę.') : label('timeGap','Ta godzina nie istnieje po zmianie czasu.'));
  return matches[0].toISOString();
}
function eventFromForm(form) {
  const date = form.elements.startDate.value, startTime = form.elements.startTime.value;
  const endDate = form.elements.endDate.value, endTime = form.elements.endTime.value;
  const isHoliday = form.elements.isHoliday.checked;
  if (isHoliday && !date) throw new Error('Wybierz datę święta.');
  if (isHoliday && !form.elements.region.value) throw new Error('Wybierz obszar obowiązywania święta.');
  if (startTime && !date || endTime && !date || endDate && !date) throw new Error('Godzina wymaga daty, a data zakończenia wymaga daty rozpoczęcia.');
  const start = date && startTime ? toUtc(`${date}T${startTime}`) : null, end = endTime ? toUtc(`${endDate || date}T${endTime}`) : null;
  if (endDate && endDate < date || end && start && Date.parse(end) < Date.parse(start)) throw new Error(label('endBeforeStart','Zakończenie nie może być wcześniejsze od rozpoczęcia.'));
  const sourceUrl = form.elements.sourceUrl.value.trim();
  if (sourceUrl && !/^https:\/\/[^\s]+$/.test(sourceUrl)) throw new Error(label('invalidSource','Oficjalne źródło musi być poprawnym adresem HTTPS.'));
  const event = { date:date || null, start, endDate:endDate || null, end, timezone:'Europe/Brussels', city:form.elements.city.value.trim(), venue:form.elements.venue.value.trim(), address:form.elements.address.value.trim(), organizer:form.elements.organizer.value.trim(), category:form.elements.category.value.trim(), region:form.elements.region.value, sourceUrl, status:form.elements.eventStatus.value, familyFriendly:form.elements.familyFriendly.checked };
  if (isHoliday) event.isHoliday = true;
  if (form.elements.image.value.trim()) { event.image = form.elements.image.value.trim(); event.imageRightsConfirmed = form.elements.imageRightsConfirmed.checked; }
  if (form.elements.price.value !== '') { event.price = Number(form.elements.price.value); event.priceCurrency = 'EUR'; }
  return event;
}
async function load() {
  try { const data = await cmsRequest('ai-editor'); rows = data.candidates.filter(row => row.kind === 'event'); render(); renderCalendar(); notice(''); }
  catch (error) { notice(error.message); }
}
function render() {
  const filter = $('#events-editor-filter').value;
  const visible = rows.filter(row => !filter || row.status === filter).sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  $('#events-editor-list').innerHTML = visible.length ? `<table class="data-table"><thead><tr><th>${label('colEvent','Wydarzenie')}</th><th>${label('colDate','Termin')}</th><th>${label('colRegion','Region')}</th><th>${label('colSource','Źródło')}</th><th>${label('colStatus','Status')}</th><th>${label('colVerification','Weryfikacja')}</th><th>${label('colActions','Akcje')}</th></tr></thead><tbody>${visible.map(row => {
    const event = JSON.parse(row.event_json || '{}'), verification = JSON.parse(row.verification_json || '{}');
    const actions = [`<button type="button" class="secondary" data-event-edit="${row.id}">${label('open','Otwórz')}</button>`];
    if (['pending_review','changes_requested','approved','scheduled'].includes(row.status) && (row.owner_kind === 'admin' || verification.status === 'verified')) actions.push(`<button type="button" class="primary" data-event-action="approve-publish-event" data-id="${row.id}">Akceptuj i opublikuj</button>`);
    if (['approved','scheduled'].includes(row.status)) actions.push(`<input type="datetime-local" data-event-slot="${row.id}" aria-label="${label('scheduleAt','Termin publikacji')}" value="${escapeHtml(local(row.scheduled_at || row.proposed_publish_at))}"><button type="button" class="secondary" data-event-action="scheduled" data-id="${row.id}">${label('scheduleAction','Zaplanuj')}</button>`);
    if (['draft','pending_review','approved','scheduled'].includes(row.status)) actions.push(`<button type="button" class="ghost danger" data-event-action="rejected" data-id="${row.id}">${label('reject','Odrzuć')}</button>`);
    if (row.status === 'published') actions.push(`<button type="button" class="ghost danger" data-event-action="archived" data-id="${row.id}">${label('withdraw','Wycofaj')}</button>`);
    actions.push(`<button type="button" class="ghost danger" data-event-action="delete-event" data-id="${row.id}">${label('deleteEvent','Usuń wydarzenie')}</button>`);
    const region = event.region ? label(event.region,event.region) : label('unspecifiedRegion','Nieokreślony');
    const source = row.owner_kind === 'agent' ? label('aiSource','AI Redaktor') : label('editorialSource','Redakcja');
    const term = event.start ? displayDateTime(event.start) : event.date ? displayDate(event.date) : label('undated','Termin do ustalenia');
    return `<tr><td data-label="${label('colEvent','Wydarzenie')}"><strong>${escapeHtml(row.title || label('untitled','Wydarzenie bez tytułu'))}</strong><span class="table-subtitle">${escapeHtml(categoryLabel(event.category || row.category))}</span></td><td data-label="${label('colDate','Termin')}">${escapeHtml(term)}</td><td data-label="${label('colRegion','Region')}">${escapeHtml(region)}</td><td data-label="${label('colSource','Źródło')}">${escapeHtml(source)}</td><td data-label="${label('colStatus','Status')}">${escapeHtml(statusLabel(row.status))}</td><td data-label="${label('colVerification','Weryfikacja')}">${row.owner_kind === 'agent' ? verification.status === 'verified' ? label('verified','Potwierdzone') : label('needsReview','Do sprawdzenia') : '—'}</td><td data-label="${label('colActions','Akcje')}"><div class="row-actions">${actions.join('')}</div></td></tr>`;
  }).join('')}</tbody></table>` : `<p class="empty-state">${label('empty','Brak wydarzeń w wybranym widoku.')}</p>`;
}
function dateKey(value) { return value ? new Intl.DateTimeFormat('sv-SE',{ timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(value)) : null; }
function renderCalendar() {
  const grid = $('#event-calendar-grid');
  if (!grid) return;
  const language = document.documentElement.lang || 'pl';
  $('#event-calendar-month').textContent = new Intl.DateTimeFormat(language,{month:'long',year:'numeric'}).format(calendarMonth);
  const dayNames = Array.from({length:7},(_,index) => new Intl.DateTimeFormat(language,{weekday:'short'}).format(new Date(Date.UTC(2024,0,1+index))));
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  const offset = (new Date(year,month,1).getDay()+6)%7;
  const days = new Date(year,month+1,0).getDate();
  const cells = dayNames.map(name => `<div class="calendar-weekday">${escapeHtml(name)}</div>`);
  for (let i=0;i<offset;i++) cells.push('<div class="calendar-day calendar-day--empty" aria-hidden="true"></div>');
  for (let day=1;day<=days;day++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const events = rows.filter(row => { const event = JSON.parse(row.event_json || '{}'); const first = event.date || dateKey(event.start), last = event.endDate || dateKey(event.end) || first; return first && first <= key && last >= key && row.status !== 'archived'; });
    const holidays = window.PbeCalendar?.holidays(key) || [];
    const isSunday = window.PbeCalendar?.sunday(key);
    const isToday = key === window.PbeCalendar?.today();
    cells.push(`<div class="calendar-day${holidays.length || isSunday || events.some(row => JSON.parse(row.event_json || '{}').isHoliday) ? ' is-holiday' : ''}${isToday ? ' is-today' : ''}"><div class="calendar-day-head"><strong>${day}</strong><button type="button" class="calendar-add" data-event-new-date="${key}" aria-label="Dodaj wydarzenie ${key}" title="Dodaj wydarzenie">+</button></div>${holidays.map(item => `<span class="calendar-holiday" title="${escapeHtml(window.PbeCalendar.label(item,language))}">${escapeHtml(window.PbeCalendar.label(item,language))}</span>`).join('')}${events.map(row => `<button type="button" class="calendar-entry status-${escapeHtml(row.status)}" data-event-edit="${row.id}" title="${escapeHtml(row.title || label('untitled','Wydarzenie bez tytułu'))}">${escapeHtml(row.title || label('untitled','Wydarzenie bez tytułu'))} · ${escapeHtml(statusLabel(row.status))}</button>`).join('')}</div>`);
  }
  grid.innerHTML = cells.join('');
}
function open(row = null, initialDate = '') {
  selected = row;
  const form = $('#event-editor-form'); form.reset(); form.dataset.dirty = 'false'; $('#event-editor-error').textContent = '';
  const event = row ? JSON.parse(row.event_json || '{}') : {};
  for (const key of ['title','description','body']) form.elements[key].value = row?.[key] || '';
  const localized = row ? JSON.parse(row.article_fields_json || '{}') : {};
  for (const language of ['nl','fr']) for (const key of ['title','description','body']) form.elements[`${key}_${language}`].value = localized[`${key}_${language}`] || '';
  eventTranslations.reset();
  document.querySelector('[data-event-language-tab="pl"]').click();
  for (const key of ['category','region','city','venue','address','organizer','sourceUrl','image']) form.elements[key].value = event[key] || '';
  if (!form.elements.category.value) form.elements.category.value = 'Inne';
  form.elements.eventStatus.value = event.status || 'scheduled';
  form.elements.imageRightsConfirmed.checked = event.imageRightsConfirmed === true;
  for (const key of ['start','end']) { const value = local(event[key]); const savedDate = event[key === 'start' ? 'date' : 'endDate']; form.elements[`${key}Date`].value = key === 'start' ? savedDate || value.slice(0,10) : savedDate || (value.slice(0,10) !== (event.date || local(event.start).slice(0,10)) ? value.slice(0,10) : ''); form.elements[`${key}Time`].value = value.slice(11,16); }
  if (!row) form.elements.startDate.value = initialDate;
  form.elements.isHoliday.checked = event.isHoliday === true;
  syncHolidayTime(form);
  form.elements.price.value = event.price ?? '';
  form.elements.familyFriendly.checked = event.familyFriendly === true;
  $('#event-editor-verify').hidden = !row || ['published','archived','rejected'].includes(row.status);
  const actions = [];
  if (row) {
    const verification = JSON.parse(row.verification_json || '{}');
    if (['pending_review','changes_requested','approved','scheduled'].includes(row.status) && (row.owner_kind === 'admin' || verification.status === 'verified')) actions.push(`<button type="button" class="primary" data-event-action="approve-publish-event" data-id="${row.id}">Akceptuj i opublikuj</button>`);
    if (['approved','scheduled'].includes(row.status)) actions.push(`<input type="datetime-local" data-event-slot="${row.id}" aria-label="${label('scheduleAt','Termin publikacji')}" value="${escapeHtml(local(row.scheduled_at || row.proposed_publish_at))}"><button type="button" class="secondary" data-event-action="scheduled" data-id="${row.id}">${label('scheduleAction','Zaplanuj')}</button>`);
    if (row.status === 'published') actions.push(`<button type="button" class="ghost danger" data-event-action="archived" data-id="${row.id}">${label('withdraw','Wycofaj')}</button>`);
    actions.push(`<button type="button" class="ghost danger" data-event-action="delete-event" data-id="${row.id}">${label('deleteEvent','Usuń wydarzenie')}</button>`);
  }
  $('#event-editor-actions').innerHTML = actions.join('');
  form.querySelector('[type="submit"]').textContent = row?.status === 'published' ? 'Zapisz zmiany' : 'Zapisz';
  $('#event-editor-dialog').showModal();
}
$('#event-new').addEventListener('click',() => open());
$('#event-calendar-new').addEventListener('click',() => open());
$('#event-calendar-prev').addEventListener('click',() => { calendarMonth.setMonth(calendarMonth.getMonth()-1); renderCalendar(); });
$('#event-calendar-next').addEventListener('click',() => { calendarMonth.setMonth(calendarMonth.getMonth()+1); renderCalendar(); });
$('#event-calendar-grid').addEventListener('click',event => { const create=event.target.closest('[data-event-new-date]'); if (create) return open(null,create.dataset.eventNewDate); const button=event.target.closest('[data-event-edit]'); if (button) open(rows.find(row => row.id === button.dataset.eventEdit)); });
function syncHolidayTime(form) {
  for (const key of ['startTime','endTime']) { form.elements[key].disabled = form.elements.isHoliday.checked; if (form.elements.isHoliday.checked) form.elements[key].value = ''; }
  if (form.elements.isHoliday.checked) form.elements.endDate.value = form.elements.startDate.value;
}
$('#event-editor-form').elements.isHoliday.addEventListener('change',event => syncHolidayTime(event.target.form));
$('#event-editor-form').elements.startDate.addEventListener('change',event => { if (event.target.form.elements.isHoliday.checked) syncHolidayTime(event.target.form); });
document.addEventListener('cms:load-events',load);
document.addEventListener('cmslanguagechange',() => { applyEventLanguage(); render(); renderCalendar(); });
applyEventLanguage();
const formatCopy = {
  pl:{bold:'Pogrubienie',italic:'Kursywa',bullets:'Lista punktowana',numbers:'Lista numerowana',paragraph:'Nowy akapit',help:'Pogrubienia, kursywa, listy i akapity będą widoczne na stronie wydarzenia.'},
  en:{bold:'Bold',italic:'Italic',bullets:'Bulleted list',numbers:'Numbered list',paragraph:'New paragraph',help:'Bold, italic, lists and paragraphs will appear on the event page.'},
  nl:{bold:'Vet',italic:'Cursief',bullets:'Opsomming',numbers:'Genummerde lijst',paragraph:'Nieuwe alinea',help:'Vet, cursief, lijsten en alinea’s verschijnen op de evenementpagina.'},
  fr:{bold:'Gras',italic:'Italique',bullets:'Liste à puces',numbers:'Liste numérotée',paragraph:'Nouveau paragraphe',help:'Le gras, l’italique, les listes et les paragraphes apparaîtront sur la page de l’événement.'}
};
function formatLanguage() {
  const words = formatCopy[document.documentElement.lang] || formatCopy.pl;
  document.querySelectorAll('[data-event-format]').forEach(button => button.setAttribute('aria-label',words[button.dataset.eventFormat]));
  document.querySelector('.event-body-field small').textContent = words.help;
}
formatLanguage();
document.addEventListener('cmslanguagechange',formatLanguage);
document.querySelector('.event-markdown-toolbar').addEventListener('click',event => {
  const action = event.target.closest('[data-event-format]')?.dataset.eventFormat;
  if (!action) return;
  const input = $('#event-body'), start = input.selectionStart, end = input.selectionEnd, chosen = input.value.slice(start,end);
  const replacement = action === 'bold' ? `**${chosen || 'tekst'}**` : action === 'italic' ? `*${chosen || 'tekst'}*` : action === 'bullets' ? (chosen || 'Element listy').split('\n').map(line => `- ${line}`).join('\n') : action === 'numbers' ? (chosen || 'Element listy').split('\n').map((line,index) => `${index+1}. ${line}`).join('\n') : '\n\n';
  input.setRangeText(replacement,start,end,'select'); input.focus(); input.dispatchEvent(new Event('input',{bubbles:true}));
});
$('#event-image-upload').addEventListener('click',() => document.dispatchEvent(new CustomEvent('cms:upload-event-image',{detail:$('#event-editor-form').elements.image})));
$('#event-editor-close').addEventListener('click',() => $('#event-editor-dialog').close());
$('#events-editor-refresh').addEventListener('click',load);
$('#events-editor-filter').addEventListener('change',render);
document.querySelector('.nav-item[data-view="events-editor"]').addEventListener('click',load);
$('#event-editor-form').addEventListener('input',event => { if (!event.target.closest('#event-editor-actions')) event.currentTarget.dataset.dirty = 'true'; });
$('#event-editor-form').addEventListener('submit',async event => {
  event.preventDefault(); const form = event.currentTarget;
  try {
    const details = eventFromForm(form);
    const articleFields = Object.fromEntries(['nl','fr'].flatMap(language => ['title','description','body'].map(key => [`${key}_${language}`, form.elements[`${key}_${language}`].value])));
    const data = { title:form.elements.title.value.trim(), description:form.elements.description.value.trim(), body:form.elements.body.value.trim(), articleFields, category:details.category, region:details.region, event:details, sources:details.sourceUrl ? [{url:details.sourceUrl}] : [] };
    if (selected?.status === 'published' && !await confirmAction('Zapisać zmiany w opublikowanym wydarzeniu?', 'Sprawdź daty, treść i oficjalne źródło. Zmiany będą od razu widoczne na stronie.')) return;
    await cmsRequest('ai-editor',{},'POST',selected ? { action:'edit',id:selected.id,...data,confirmed:selected.status === 'published' } : { action:'manual-event',id:crypto.randomUUID().replaceAll('-','').slice(0,20),...data });
    await load(); $('#event-editor-dialog').close(); notice(selected?.status === 'published' ? 'Zmiany w opublikowanym wydarzeniu zapisano.' : label('saved','Wydarzenie zapisane. Potwierdź dane przed publikacją.'));
  } catch (error) { $('#event-editor-error').textContent = error.message; }
});
$('#event-editor-verify').addEventListener('click',async () => {
  if (!selected) return;
  const form = $('#event-editor-form');
  try {
    if (!await confirmAction(label('confirmVerify','Potwierdzić wydarzenie?'), selected.owner_kind === 'admin' ? label('confirmManualDetail','Potwierdź poprawność daty, organizatora i treści wydarzenia.') : label('confirmVerifyDetail','Otwórz oficjalne źródło i porównaj termin, miejsce oraz organizatora z formularzem.'))) return;
    const details = eventFromForm(form);
    await cmsRequest('ai-editor',{},'POST',{ action:'verify-event',id:selected.id,event:details,confirmed:true });
    await load(); $('#event-editor-dialog').close(); notice(label('verificationSaved','Weryfikacja zapisana.'));
  } catch (error) { $('#event-editor-error').textContent = error.message; }
});
async function performAction(button, scope) {
  const id = button.dataset.id, status = button.dataset.eventAction;
  try {
    if (scope.id === 'event-editor-actions' && $('#event-editor-form').dataset.dirty === 'true') throw new Error(label('saveBeforeDecision','Zapisz zmiany przed podjęciem decyzji.'));
    if (status === 'delete-event' && !await confirmAction(label('confirmDeleteEvent','Trwale usunąć wydarzenie?'), label('confirmDeleteEventDetail','Wydarzenie zniknie z CMS i strony publicznej. Tej operacji nie można cofnąć.'))) return;
    if (['rejected','archived','archive-event'].includes(status) && !await confirmAction(status === 'rejected' ? label('confirmReject','Odrzucić wydarzenie?') : label('confirmWithdraw','Wycofać wydarzenie?'), label('confirmDetail','Decyzja zostanie zapisana w historii.'))) return;
    const localTime = status === 'scheduled' ? scope.querySelector(`[data-event-slot="${id}"]`).value : null;
    if (status === 'scheduled') toUtc(localTime);
    if (status === 'approve-publish-event' && !await confirmAction('Akceptować i opublikować wydarzenie?', 'Wydarzenie będzie od razu widoczne publicznie. Sprawdź wcześniej treść, daty i źródło.')) return;
    await cmsRequest('ai-editor',{},'POST',['archive-event','publish-event','approve-publish-event','delete-event'].includes(status) ? { action:status,id } : { action:'status',id,status,...(localTime ? { localTime } : {}) });
    await load(); if (scope.id === 'event-editor-actions') $('#event-editor-dialog').close(); notice(label('decisionSaved','Decyzja została zapisana.'));
  } catch (error) { if (scope.id === 'event-editor-actions') $('#event-editor-error').textContent = error.message; else notice(error.message); }
}
$('#events-editor-list').addEventListener('click',async event => {
  const edit = event.target.closest('[data-event-edit]'); if (edit) return open(rows.find(row => row.id === edit.dataset.eventEdit));
  const button = event.target.closest('[data-event-action]'); if (button) await performAction(button,$('#events-editor-list'));
});
$('#event-editor-actions').addEventListener('click',async event => { const button = event.target.closest('[data-event-action]'); if (button) await performAction(button,$('#event-editor-actions')); });
