import { cmsRequest } from './modules/client.js';
import { confirmAction, enableTabKeyboard } from './ui.js';
const $ = selector => document.querySelector(selector);
const labels = { pending: 'Czeka na akceptację', paused: 'Wstrzymane', approved: 'Zaakceptowane', scheduled: 'Zaplanowane', active: 'Aktywne', ended: 'Zakończone', completed: 'Zakończone', rejected: 'Odrzucone', cancelled: 'Wycofane', pending_payment: 'Czeka na płatność', pending_approval: 'Czeka na akceptację', needs_reschedule: 'Wymaga nowego terminu lub zwrotu', payment_failed: 'Płatność nieudana', refund_review: 'Zwrot częściowy — sprawdź', refunded: 'Zwrócone' };
const paymentNames = { paid:'Opłacone',pending:'Oczekuje',pending_payment:'Czeka na płatność',payment_failed:'Płatność nieudana',not_required:'Nie wymaga płatności',refunded:'Zwrócono',partial_refund:'Częściowy zwrot',failed:'Nieudana',succeeded:'Opłacone' };
const eventNames = { 'checkout.session.completed':'Płatność potwierdzona','checkout.session.expired':'Sesja płatności wygasła','payment_intent.payment_failed':'Płatność nieudana','charge.refunded':'Zwrot środków','refund.created':'Zlecono zwrot','refund.updated':'Aktualizacja zwrotu' };
const errors = { unavailable: 'API reklam jest niedostępne. Sprawdź połączenie z bazą.', unauthorized: 'Brak uprawnień. Zaloguj się ponownie.', dates: 'Niepoprawny zakres dat.', settings: 'Wprowadź poprawne ceny. Włączony rynek wymaga cen większych od zera.', validation: 'Sprawdź dane formularza.', image: 'Wymagany poprawny PNG/JPEG/WebP do 500 KB.', conflict: 'Ktoś zmienił dane. Odśwież listę przed ponowną edycją.', full: 'Brak miejsc:', immutableMarket: 'Nie można zmienić języka ani typu istniejącego zamówienia.', immutableSchedule: 'Zmiana terminu opłaconej grupy wymaga nowej rezerwacji.', useGroupModeration: 'Zmień status całego zamówienia.', paymentRequired: 'Najpierw potwierdź płatność za całe zamówienie.', needsReschedule: 'Planowany start minął. Ustal nowy termin lub zwrot.', market: 'Niepoprawny rynek.' };
let configuration, orders = [], editing = null;
let tab = 'orders';
const isShowcase = order => order?.demoSet === 'showcase-2026-09-29' && order.source === 'manual' && order.paymentStatus === 'not_required';
const money = value => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'EUR' }).format(value / 100);
const paymentLabel = order => order.source === 'manual' && order.paymentStatus === 'not_required' ? 'Dodane bezpłatnie przez administratora' : paymentNames[order.paymentStatus] || 'Brak płatności';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const errorText = error => (errors[error.code] || error.message || 'Nie udało się zapisać.') + (Array.isArray(error.details) ? ' ' + error.details.map(day => `${day.date || 'Wybrany okres'}: zajęte ${day.used}/${day.capacity}`).join(', ') : '');
const canModerate = order => order?.status === 'pending' && (order.source === 'public' && order.paymentStatus === 'paid' && order.effectiveStatus === 'pending_approval' || order.source === 'manual' && order.paymentStatus === 'not_required');
const moderationButtons = order => canModerate(order) ? `<button class="primary" type="button" data-ad-moderate="approved" data-ad-id="${escape(order.id)}">Akceptuj</button><button class="secondary" type="button" data-ad-moderate="rejected" data-ad-id="${escape(order.id)}">Odrzuć</button>` : '';
const sharedEditButton = order => `<button class="secondary" type="button" data-ad-shared-edit="${escape(order.id)}">Edytuj</button>`;
async function api(action, method = 'GET', body, params = {}) {
  return cmsRequest('ads', { action, ...params }, method, body);
}
async function load() {
  $('#ads-notice').textContent = 'Ładowanie…';
  try {
    const [settings, result] = await Promise.all([api('admin-settings'), api('admin-orders')]);
    configuration = settings; orders = result.orders;
    $('#ads-prices').innerHTML = Object.entries(settings.languages).map(([key, language]) => `<fieldset><legend>${escape(language.name)}</legend><div class="form-grid"><label>Zamówienia<select name="${key}-enabled"><option value="false">Wyłączone</option><option value="true" ${settings.data.markets[key].enabled ? 'selected' : ''}>Włączone</option></select></label>${['TOP', 'STANDARD', 'PREMIUM'].map(type => `<label>${escape(type)} / dzień (EUR)<input name="${key}-${type}" type="number" min="0" max="10000" step="0.01" required value="${settings.data.markets[key].prices[type] / 100}"></label>`).join('')}</div><p>PREMIUM: 0 EUR wyłącza publiczne zamówienia tego miejsca.</p></fieldset>`).join('');
    await Promise.all(Object.keys(settings.languages).map(async (language, index) => {
      const occupancy = await Promise.all(['PREMIUM', 'TOP', 'STANDARD'].map(async type => {
        try { const available = await api('availability', 'GET', null, { language, type, startDate: settings.today, endDate: settings.today, durationDays: 1 }); const day = available.daysAvailable[0]; return `${type}: ${day.used}/${day.capacity}`; }
        catch { return `${type}: brak danych`; }
      }));
      const note = document.createElement('p'); note.className = 'muted'; note.textContent = `Zajętość miejsc w najbliższych 24 godzinach: ${occupancy.join(' · ')}`;
      $('#ads-prices').querySelectorAll('fieldset')[index].append(note);
    }));
    for (const form of [$('#ads-filters'), $('#ads-edit')]) {
      const select = form.elements.namedItem('language'); const previous = select.value;
      select.innerHTML = (form.id === 'ads-filters' ? '<option value="">Wszystkie</option>' : '') + Object.entries(settings.languages).map(([key, language]) => `<option value="${escape(key)}">${escape(language.name)}</option>`).join('');
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
    }
    applyLanguage(); render(); $('#ads-notice').textContent = '';
    document.dispatchEvent(new CustomEvent('cms:ads-data',{detail:{orders,configuration}}));
  } catch (error) { $('#ads-notice').textContent = errorText(error); }
}
function render() {
  const filter = Object.fromEntries(new FormData($('#ads-filters')));
  const query=(filter.query||'').trim().toLocaleLowerCase('pl');
  const filtered = orders.filter(order => (!query || `${order.title} ${order.company} ${order.email}`.toLocaleLowerCase('pl').includes(query)) && (!filter.language || filter.language === order.language) && (!filter.type || filter.type === order.type) && (!filter.status || (filter.status === 'approved' ? order.status === 'approved' : filter.status === order.effectiveStatus)) && (!filter.from || isShowcase(order) || order.endDate >= filter.from) && (!filter.to || order.startDate <= filter.to) && (tab === 'orders' || tab === 'payments' && order.paymentStatus && order.paymentStatus !== 'not_required' || order.effectiveStatus === tab || tab === 'ended' && ['ended','completed'].includes(order.effectiveStatus)));
  $('#ads-orders').innerHTML = filtered.length ? `<table class="data-table"><thead><tr><th>Ogłoszenie</th><th>Status</th><th>Okres</th><th>Pakiet</th><th>${tab==='payments'?'Płatność':'Kwota'}</th><th>Akcje</th></tr></thead><tbody>${filtered.map(order => `<tr><td data-label="Ogłoszenie"><strong>${escape(order.title)}</strong><span class="table-subtitle">${escape(order.company)} · ${escape(order.language.toUpperCase())}</span></td><td data-label="Status"><span class="status-badge status-${escape(order.effectiveStatus)}">${labels[order.effectiveStatus]||escape(order.effectiveStatus)}</span></td><td data-label="Okres">${order.periods?.length ? escape(order.periods.map(period => period.date).join(', ')) : `${escape(order.startDate)} – ${isShowcase(order)?'bezterminowo':escape(order.endDate)}`}</td><td data-label="Pakiet">${escape(order.type)}</td><td data-label="${tab==='payments'?'Płatność':'Kwota'}">${tab==='payments'?escape(paymentNames[order.paymentStatus]||'Brak płatności'):money(order.totalPrice)}</td><td data-label="Akcje"><div class="row-actions"><button class="secondary" type="button" data-ad-edit="${escape(order.id)}">Szczegóły</button>${sharedEditButton(order)}${moderationButtons(order)}</div></td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Brak ogłoszeń spełniających kryteria.</p>';
  $('#ads-orders').querySelectorAll('tbody tr').forEach((row, index) => {
    if (filtered[index].source !== 'manual' || filtered[index].paymentStatus !== 'not_required') return;
    const label = document.createElement('small'); label.className = 'table-subtitle'; label.textContent = paymentLabel(filtered[index]);
    row.querySelector(tab === 'payments' ? '[data-label="Płatność"]' : '[data-label="Kwota"]')?.append(label);
  });
}
function editPrice() {
  if (isShowcase(editing)) { $('#ads-edit-price').textContent = 'Bezterminowo (pokazowe). Aby ukryć, wybierz status Anulowane.'; return; }
  if (editing?.source === 'public') { $('#ads-edit-price').textContent = `Cena tej wersji: ${money(editing.totalPrice)}. Całe zamówienie: ${money(editing.groupTotalPrice || editing.totalPrice)}. Cena i termin pozostają zgodne z opłaconą rezerwacją.`; return; }
  const form = $('#ads-edit'); const input = Object.fromEntries(new FormData(form));
  const days = (Date.parse(input.endDate) - Date.parse(input.startDate)) / 86400000 + 1;
  const price = editing ? editing.dailyPrice : input.complimentary === 'true' ? 0 : configuration.data.markets[input.language]?.prices[input.type];
  $('#ads-edit-price').textContent = days > 0 && days <= 366 ? `${days} dni × ${money(price)} = ${money(days * price)}` : 'Wybierz poprawny zakres dat.';
}
async function open(order) {
  if (!configuration) { $('#ads-notice').textContent = 'Najpierw wczytaj ustawienia reklam.'; return; }
  if (order) {
    try { order = await api('admin-detail', 'GET', null, { id: order.id }); }
    catch (error) { $('#ads-notice').textContent = errorText(error); return; }
  }
  editing = order || null; const form = $('#ads-edit'); form.reset();
  form.querySelector('.form-grid').hidden = Boolean(order);
  $('#ads-save').hidden = Boolean(order);
  $('#ads-edit-price').hidden = Boolean(order);
  $('#ads-edit-note').hidden = !order;
  const actions = $('#ads-moderation-actions'); actions.innerHTML = order ? sharedEditButton(order) + moderationButtons(order) : ''; actions.hidden = !order;
  $('#ads-delete').hidden = !order;
  $('#ads-delete').textContent = order?.source === 'public' ? 'Wycofaj ogłoszenie' : 'Usuń ogłoszenie';
  const input = order || { language: Object.keys(configuration.languages)[0], type: 'STANDARD', status: 'approved', startDate: configuration.today, endDate: configuration.today };
  for (const [key, value] of Object.entries(input)) { const control = form.elements.namedItem(key); if (control) control.value = value; }
  form.elements.language.disabled = form.elements.type.disabled = Boolean(order);
  for (const key of ['startDate', 'endDate']) { form.elements[key].readOnly = isShowcase(order) || order?.source === 'public' && (key === 'endDate' || order.effectiveStatus !== 'needs_reschedule' || Boolean(order.periods)); form.elements[key].closest('label').hidden = isShowcase(order) || Boolean(order?.periods); }
  form.querySelector('[data-period-reschedule]')?.remove();
  if (order?.periods && order.effectiveStatus === 'needs_reschedule') {
    const label = document.createElement('label'); label.dataset.periodReschedule = '';
    label.textContent = `Nowe dni emisji (${order.periods.length}, rozdziel przecinkiem)`;
    const textarea = document.createElement('textarea'); textarea.name = 'periodDates'; textarea.value = order.periods.map(period => period.date).join(', '); textarea.required = true;
    label.append(textarea); form.append(label);
  }
  updateCreativeFields();
  $('#ads-free-label').hidden = Boolean(order);
  const remaining = order?.periods?.length ? Math.ceil(order.periods.reduce((sum, period) => sum + Math.max(0, Date.parse(period.actualEndAt || period.plannedEndAt || 0) - Math.max(Date.now(), Date.parse(period.actualStartAt || period.plannedStartAt || 0))),0) / 3600000) : order?.actualEndAt ? Math.max(0, Math.ceil((Date.parse(order.actualEndAt) - Date.now()) / 3600000)) : null;
  $('#ads-order-meta').innerHTML = order ? `<span><strong>Status:</strong> ${escape(labels[order.effectiveStatus]||order.effectiveStatus)}</span><span><strong>Źródło:</strong> ${order.source==='manual'?'Dodane ręcznie':'Zamówienie klienta'}</span><span><strong>Pakiet:</strong> ${escape(order.type)}</span><span><strong>Język podstawowy:</strong> ${escape(order.primaryLanguage||order.language)}</span><span><strong>Języki:</strong> ${escape((order.languages||[order.language]).join(', '))}</span><span><strong>Kwota zamówienia:</strong> ${money(order.groupTotalPrice||order.totalPrice)}</span><span><strong>Płatność:</strong> ${escape(paymentNames[order.paymentStatus]||'Brak płatności')}</span><span><strong>Planowany start:</strong> ${escape(order.plannedStartAt||'Po płatności i akceptacji')}</span><span><strong>Faktyczny start:</strong> ${escape(order.actualStartAt||'—')}</span><span><strong>Koniec:</strong> ${escape(order.actualEndAt||order.plannedEndAt||'—')}</span>${remaining === null ? '' : `<span><strong>Pozostało:</strong> ${remaining} h</span>`}${order.refundRequired?'<span class="danger">Wymaga ręcznej obsługi zwrotu</span>':''}` : '';
  if (order?.periods) {
    const format = value => value ? new Intl.DateTimeFormat('pl-BE',{timeZone:'Europe/Brussels',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : null;
    const periods = document.createElement('p'); periods.textContent = 'Okresy emisji (Europe/Brussels): ' + order.periods.map(period => `${period.date}: ${format(period.actualStartAt || period.plannedStartAt) || 'po opłaceniu i akceptacji'} – ${format(period.actualEndAt || period.plannedEndAt) || '24 godziny od startu'}`).join('; ');
    $('#ads-order-meta').append(periods);
  }
  if (order?.groupId) {
    const versions = document.createElement('div'); versions.className = 'ads-version-links'; versions.append(document.createTextNode('Podgląd i edycja wersji: '));
    for (const versionOrder of orders.filter(item => item.groupId === order.groupId)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = versionOrder.language.toUpperCase(); button.disabled = versionOrder.id === order.id;
      button.onclick = () => { $('#ads-dialog').close(); open(versionOrder); };
      versions.append(button);
    }
    $('#ads-order-meta').append(versions);
  }
  $('#ads-payment-history').textContent = '';
  if (order?.groupId) {
    try { const result = await api('admin-payment-events', 'GET', null, { groupId: order.groupId }); $('#ads-payment-history').textContent = result.events.map(event => `${event.received_at}: ${eventNames[event.event_type]||'Zdarzenie płatności'}`).join(' · ') || 'Brak zdarzeń płatności.'; }
    catch { $('#ads-payment-history').textContent = 'Historia płatności jest niedostępna.'; }
  }
  if (order) {
    try { const result = await api('admin-order-history', 'GET', null, { id: order.id }); $('#ads-payment-history').textContent += ' · Historia moderacji: ' + (result.changes.map(change => `${change.created_at}: ${labels[change.previous_status]||'Nowe'} → ${labels[change.new_status]||'Zmieniono'}`).join(' · ') || 'brak'); }
    catch { $('#ads-payment-history').textContent += ' · Historia moderacji niedostępna.'; }
  }
  $('#ads-edit-error').textContent = ''; $('#ads-image-preview').hidden = !order || order.kind === 'text';
  if (order) $('#ads-image-preview').src = order.image;
  editPrice(); $('#ads-dialog').showModal();
}
function updateCreativeFields() {
  const form = $('#ads-edit');
  const limits = { PREMIUM:{title:70,description:200}, TOP:{title:60,description:160}, STANDARD:{title:70,description:500} }[form.elements.type.value];
  if (limits) {
    form.elements.title.maxLength = limits.title;
    form.elements.description.maxLength = limits.description;
  }
  const textOnly = editing ? editing.kind === 'text' : form.elements.type.value !== 'PREMIUM';
  form.elements.title.required = !textOnly;
  form.elements.imageFile.required = !textOnly && !editing;
  form.elements.imageFile.closest('label').hidden = textOnly;
  for (const key of ['company','contact','publicPhone','publicEmail','url','customerName']) form.elements[key].required = false;
}
$('#ads-edit').addEventListener('change', event => { if (event.target.name === 'type') updateCreativeFields(); editPrice(); });
function openSharedOrder(id = '') { $('#ads-order-frame').src = '/zamow-ogloszenie/?cms=1' + (id ? `&edit=${encodeURIComponent(id)}` : ''); $('#ads-order-dialog').showModal(); }
$('#ads-new').onclick = () => openSharedOrder();
$('#ads-order-close').onclick = () => $('#ads-order-dialog').close();
$('#ads-order-dialog').addEventListener('close', () => { $('#ads-order-frame').src = 'about:blank'; });
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== $('#ads-order-frame').contentWindow || event.data?.type !== 'pbe:admin-ad-saved') return;
  $('#ads-order-dialog').close();
  await load();
  $('#ads-notice').textContent = event.data.edited ? 'Zmiany ogłoszenia zapisane.' : event.data.published ? 'Bezpłatne ogłoszenie zapisane i zatwierdzone.' : 'Bezpłatne ogłoszenie zapisane do późniejszego zatwierdzenia.';
});
$('#ads-close').onclick = () => $('#ads-dialog').close();
$('#ads-delete').onclick = async () => {
  if (!editing || !await confirmAction(editing.source === 'public' ? 'Wycofać ogłoszenie?' : 'Usunąć ogłoszenie?',editing.source === 'public' ? 'Zniknie ze strony i zwolni miejsce. Historia zamówienia pozostanie w CMS.' : 'Zniknie ze strony i zwolni miejsca. Tej operacji nie można cofnąć.',editing.source === 'public' ? 'Wycofaj' : 'Usuń ogłoszenie')) return;
  const button = $('#ads-delete'); button.disabled = true;
  try { await api('admin-order', 'DELETE', { id: editing.id, version: editing.version }); $('#ads-dialog').close(); await load(); $('#ads-notice').textContent = editing.source === 'public' ? 'Ogłoszenie wycofane. Historia została zachowana.' : 'Ogłoszenie usunięte.'; }
  catch (error) { $('#ads-edit-error').textContent = errorText(error); }
  finally { button.disabled = false; }
};
async function moderate(order, status, button) {
  if (!canModerate(order) || !['approved', 'rejected'].includes(status)) return;
  const warning = status === 'rejected' ? 'Opłacone zamówienie zostanie odrzucone. Zwrot płatności wymaga osobnej obsługi w Stripe.' : 'Opłacone ogłoszenie zostanie zaakceptowane i rozpocznie emisję w wybranym terminie.';
  if (!await confirmAction(status === 'approved' ? 'Zaakceptować ogłoszenie?' : 'Odrzucić ogłoszenie?', warning, status === 'approved' ? 'Akceptuj' : 'Odrzuć')) return;
  button.disabled = true;
  try {
    await api('admin-moderate-group', 'PUT', { id: order.id, version: order.version, status });
    if ($('#ads-dialog').open) $('#ads-dialog').close();
    await load();
    $('#ads-notice').textContent = status === 'approved' ? 'Ogłoszenie zaakceptowane.' : 'Ogłoszenie odrzucone. Sprawdź potrzebę zwrotu w Stripe.';
  } catch (error) {
    const target = $('#ads-dialog').open ? $('#ads-edit-error') : $('#ads-notice');
    target.textContent = errorText(error);
  } finally { button.disabled = false; }
}
for (const selector of ['#ads-orders', '#ads-moderation-actions']) $(selector).addEventListener('click', event => {
  const action = event.target.closest('[data-ad-moderate]');
  if (action) { moderate(orders.find(order => order.id === action.dataset.adId), action.dataset.adModerate, action); return; }
  const detail = event.target.closest('[data-ad-edit]'); if (detail) open(orders.find(order => order.id === detail.dataset.adEdit));
  const shared = event.target.closest('[data-ad-shared-edit]'); if (shared) { if ($('#ads-dialog').open) $('#ads-dialog').close(); openSharedOrder(shared.dataset.adSharedEdit); }
});
$('#ads-filters').onchange = render;
$('#ads-filters').addEventListener('input',render);
document.querySelectorAll('[data-ads-tab]').forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.adsTab;document.querySelectorAll('[data-ads-tab]').forEach(other=>{other.classList.toggle('is-active',other===button);other.setAttribute('aria-selected',String(other===button));});render();}));
enableTabKeyboard($('.ads-tabs'));
$('#ads-refresh').onclick = load;
$('[data-view="ads"]').addEventListener('click', load);
document.addEventListener('cms:load-summary',load);
$('#ads-settings').onsubmit = async event => {
  event.preventDefault(); if (!configuration) return;
  const button = event.submitter; button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(event.target)); const data = structuredClone(configuration.data);
    for (const language of Object.keys(configuration.languages)) {
      data.markets[language].enabled = values[`${language}-enabled`] === 'true';
      for (const type of ['TOP', 'STANDARD', 'PREMIUM']) data.markets[language].prices[type] = Math.round(Number(values[`${language}-${type}`]) * 100);
    }
    const saved = await api('admin-settings', 'PUT', { data, version: configuration.version }); configuration = { ...configuration, ...saved };
    $('#ads-notice').textContent = 'Cennik zapisany. Obowiązuje od razu. Istniejące zamówienia zachowują ceny.';
  } catch (error) { $('#ads-notice').textContent = errorText(error); } finally { button.disabled = false; }
};
$('#ads-edit').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const form = event.target; const values = Object.fromEntries(new FormData(form)); const file = form.elements.imageFile.files[0];
    const periodDatesChanged = editing?.periods && typeof values.periodDates === 'string' && values.periodDates !== editing.periods.map(period => period.date).join(', ');
    if (editing?.source === 'public' && (periodDatesChanged || !editing.periods && values.startDate !== editing.startDate)) {
      const dates = periodDatesChanged ? values.periodDates.split(/[\s,;]+/).filter(Boolean).sort() : undefined;
      await api('admin-reschedule-group', 'PUT', { id: editing.id, version: editing.version, startDate: values.startDate, dates });
      $('#ads-dialog').close(); await load(); $('#ads-notice').textContent = 'Nowy termin zapisany dla wszystkich języków. Otwórz zamówienie ponownie, aby je zatwierdzić.'; return;
    }
    let image = editing?.image;
    if (file) {
      if (file.size > 512000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw { code: 'image' };
      image = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    }
    const changingGroup = editing?.source === 'public' && values.status !== editing.status;
    if (changingGroup && !['approved', 'rejected', 'cancelled'].includes(values.status)) throw { code: 'useGroupModeration' };
    await api('admin-order', editing ? 'PUT' : 'POST', { ...values, status: changingGroup ? editing.status : values.status, kind: editing ? editing.kind : values.type === 'PREMIUM' ? 'image' : 'text', imageFile: undefined, image, language: editing?.language || values.language, type: editing?.type || values.type, id: editing?.id, version: editing?.version, complimentary: values.complimentary === 'true' });
    if (changingGroup) await api('admin-moderate-group', 'PUT', { id: editing.id, version: editing.version + 1, status: values.status });
    $('#ads-dialog').close(); await load(); $('#ads-notice').textContent = 'Reklama zapisana.';
  } catch (error) { $('#ads-edit-error').textContent = errorText(error); } finally { button.disabled = false; }
};

function applyLanguage() {const language=document.querySelector('#cms-language').value;document.querySelectorAll('#ads-prices fieldset').forEach((f,i)=>f.hidden=Object.keys(configuration.languages)[i]!==language);}
document.addEventListener('cmslanguagechange',()=>{if(configuration){applyLanguage();render();}});
