import { cmsRequest } from './modules/client.js';
import { confirmAction, enableTabKeyboard } from './ui.js';
const $ = selector => document.querySelector(selector);
const labels = { pending: 'Czeka na akceptację', changes_requested: 'Czeka na poprawki', refund_pending: 'Zwrot w toku', paused: 'Wstrzymane', approved: 'Zaakceptowane', scheduled: 'Zaplanowane', active: 'Aktywne', ended: 'Zakończone', completed: 'Zakończone', rejected: 'Odrzucone', cancelled: 'Wycofane', pending_payment: 'Czeka na płatność', pending_approval: 'Czeka na akceptację', needs_reschedule: 'Wymaga nowego terminu lub zwrotu', payment_failed: 'Płatność nieudana', refund_review: 'Zwrot częściowy — sprawdź', refunded: 'Zwrócone' };
const paymentNames = { paid:'Opłacone',pending:'Oczekuje',pending_payment:'Czeka na płatność',payment_failed:'Płatność nieudana',not_required:'Nie wymaga płatności',refunded:'Zwrócono',partial_refund:'Częściowy zwrot',failed:'Nieudana',succeeded:'Opłacone' };
const eventNames = { 'checkout.session.completed':'Płatność potwierdzona','checkout.session.expired':'Sesja płatności wygasła','payment_intent.payment_failed':'Płatność nieudana','charge.refunded':'Zwrot środków','refund.created':'Zlecono zwrot','refund.updated':'Aktualizacja zwrotu' };
const errors = { unavailable: 'API reklam jest niedostępne. Sprawdź połączenie z bazą.', unauthorized: 'Brak uprawnień. Zaloguj się ponownie.', dates: 'Niepoprawny zakres dat.', settings: 'Wprowadź poprawne ceny. Włączony rynek wymaga cen większych od zera.', validation: 'Sprawdź dane formularza.', image: 'Wymagany poprawny PNG/JPEG/WebP do 500 KB.', conflict: 'Ktoś zmienił dane. Odśwież listę przed ponowną edycją.', full: 'Brak miejsc:', immutableMarket: 'Nie można zmienić języka ani typu istniejącego zamówienia.', immutableSchedule: 'Zmiana terminu opłaconej grupy wymaga nowej rezerwacji.', useGroupModeration: 'Zmień status całego zamówienia.', useRefundAction: 'Opłacone zamówienie odrzuć przez przycisk zwrotu.', refundUnavailable: 'Stripe nie przyjął zlecenia zwrotu. Sprawdź uprawnienie Refunds: Write i spróbuj ponownie.', mailConfiguration: 'Wysyłka e-mail nie jest skonfigurowana.', paymentRequired: 'Najpierw potwierdź płatność za całe zamówienie.', needsReschedule: 'Planowany start minął. Ustal nowy termin lub zwrot.', market: 'Niepoprawny rynek.', capacityBelowBooked: 'Nie można zmniejszyć limitu poniżej już zajętych miejsc.' };
let configuration, orders = [], editing = null;
let tab = 'orders';
const isShowcase = order => order?.demoSet === 'showcase-2026-09-29' && order.source === 'manual' && order.paymentStatus === 'not_required';
const money = value => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'EUR' }).format(value / 100);
const paymentLabel = order => order.source === 'manual' && order.paymentStatus === 'not_required' ? 'Dodane bezpłatnie przez administratora' : paymentNames[order.paymentStatus] || 'Brak płatności';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const errorText = error => (error.code === 'mailUnavailable' ? 'Serwer OVHcloud nie przyjął wiadomości. Sprawdź hasło SMTP i ustawienia skrzynki.' : errors[error.code] || error.message || 'Nie udało się zapisać.') + (Array.isArray(error.details) ? ' ' + error.details.map(day => `${day.date || 'Wybrany okres'}: zajęte ${day.used}/${day.capacity}`).join(', ') : '');
const canModerate = order => order?.status === 'pending' && (order.source === 'public' && order.paymentStatus === 'paid' && order.effectiveStatus === 'pending_approval' || order.source === 'manual' && order.paymentStatus === 'not_required');
const moderationButtons = order => {
  const eligible = order && (order.source === 'public' && order.paymentStatus === 'paid' || order.source === 'manual' && order.paymentStatus === 'not_required');
  if (!eligible) return '';
  const id = escape(order.id);
  if (order.status === 'refund_pending') return `<button class="secondary" type="button" data-ad-decision="reject" data-ad-id="${id}">Ponów zwrot</button>`;
  if (!['pending', 'changes_requested'].includes(order.status)) return '';
  return `${canModerate(order) ? `<button class="primary" type="button" data-ad-moderate="approved" data-ad-id="${id}">Akceptuj</button>` : ''}<button class="secondary" type="button" data-ad-decision="changes" data-ad-id="${id}">Poproś o poprawienie</button><button class="secondary" type="button" data-ad-decision="reject" data-ad-id="${id}">${order.source === 'public' ? 'Odrzuć i zwróć pieniądze' : 'Odrzuć'}</button>`;
};
const sharedEditButton = order => `<button class="secondary" type="button" data-ad-shared-edit="${escape(order.id)}">Edytuj</button>`;
function renderDisplaySettings(display) {
  const form = $('#ads-display-settings');
  for (const [name,value] of Object.entries({
    standardVisible:display.STANDARD.visible, standardSeconds:display.STANDARD.seconds,
    topVisible:display.TOP.visible, topSeconds:display.TOP.seconds,
    premiumMaxItems:display.PREMIUM.maxItems, premiumSeconds:display.PREMIUM.seconds
  })) form.elements[name].value = value;
  form.elements.placeholderEnabled.checked = display.PREMIUM.placeholder.enabled;
  $('#ads-placeholder-locales').innerHTML = ['pl','nl','fr'].map(language => {
    const copy = display.PREMIUM.placeholder.locales[language];
    return `<fieldset><legend>${language.toUpperCase()} · baner portalu</legend><label>Tytuł<input name="placeholder-${language}-title" maxlength="100" required value="${escape(copy.title)}"></label><label>Opis<input name="placeholder-${language}-description" maxlength="250" value="${escape(copy.description)}"></label><label>Grafika z biblioteki (/images/…) <input name="placeholder-${language}-image" list="ads-placeholder-media" maxlength="500" value="${escape(copy.image)}" placeholder="/images/uploads/baner.png"></label></fieldset>`;
  }).join('');
  let mediaList = $('#ads-placeholder-media');
  if (!mediaList) { mediaList = document.createElement('datalist'); mediaList.id = 'ads-placeholder-media'; form.append(mediaList); }
}
async function api(action, method = 'GET', body, params = {}) {
  return cmsRequest('ads', { action, ...params }, method, body);
}
async function load() {
  $('#ads-notice').textContent = 'Ładowanie…';
  try {
    const [settings, result] = await Promise.all([api('admin-settings'), api('admin-orders')]);
    configuration = settings; orders = result.orders; renderDisplaySettings(settings.data.display);
    cmsRequest('cms-content',{path:'src/Images/uploads'}).then(files => {
      const list = $('#ads-placeholder-media'); if (!list || !Array.isArray(files)) return;
      list.replaceChildren(...files.filter(file => /\.(?:png|jpe?g|webp|avif)$/i.test(file.name)).map(file => {
        const option = document.createElement('option'); option.value = `/${file.path.replace(/^src\//,'').replace(/^Images\//,'images/')}`; option.label = file.name; return option;
      }));
    }).catch(() => { /* A saved local image path remains editable. */ });
    $('#ads-prices').innerHTML = Object.entries(settings.languages).map(([key, language]) => `<fieldset><legend>${escape(language.name)}</legend><div class="form-grid"><label>Zamówienia<select name="${key}-enabled"><option value="false">Wyłączone</option><option value="true" ${settings.data.markets[key].enabled ? 'selected' : ''}>Włączone</option></select></label>${['TOP', 'STANDARD', 'PREMIUM'].map(type => `<label>${escape(type)} / dzień (EUR)<input name="${key}-${type}" type="number" min="0" max="10000" step="0.01" required value="${settings.data.markets[key].prices[type] / 100}"></label>`).join('')}</div><p>PREMIUM: 0 EUR wyłącza publiczne zamówienia tego miejsca.</p></fieldset>`).join('');
    await Promise.all(Object.keys(settings.languages).map(async (language, index) => {
      const occupancy = await Promise.all(['PREMIUM', 'TOP', 'STANDARD'].map(async type => {
        try { const available = await api('availability', 'GET', null, { language, type, startDate: settings.today, endDate: settings.today, durationDays: 1 }); const day = available.daysAvailable[0]; return `${type}: ${day.used}/${day.capacity}`; }
        catch { return `${type}: brak danych`; }
      }));
      const note = document.createElement('p'); note.className = 'muted'; note.textContent = `Zajętość miejsc w najbliższych 24 godzinach: ${occupancy.join(' · ')}`;
      $('#ads-prices').querySelectorAll('fieldset')[index].append(note);
    }));
    const select = $('#ads-filters').elements.namedItem('language');
    const previous = select.value;
    select.innerHTML = '<option value="">Wszystkie</option>' + Object.entries(settings.languages).map(([key, language]) => `<option value="${escape(key)}">${escape(language.name)}</option>`).join('');
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    const capacityForm = $('#ads-capacity');
    const capacityLanguage = capacityForm.elements.language;
    const previousCapacityLanguage = capacityLanguage.value;
    capacityLanguage.innerHTML = Object.entries(settings.languages).map(([key, language]) => `<option value="${escape(key)}">${escape(language.name)}</option>`).join('');
    if (previousCapacityLanguage) capacityLanguage.value = previousCapacityLanguage;
    for (const key of ['startDate', 'endDate']) if (!capacityForm.elements[key].value) capacityForm.elements[key].value = settings.today;
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
async function open(order) {
  if (!configuration) { $('#ads-notice').textContent = 'Najpierw wczytaj ustawienia reklam.'; return; }
  if (order) {
    try { order = await api('admin-detail', 'GET', null, { id: order.id }); }
    catch (error) { $('#ads-notice').textContent = errorText(error); return; }
  }
  editing = order;
  const actions = $('#ads-moderation-actions');
  actions.innerHTML = sharedEditButton(order) + moderationButtons(order);
  actions.hidden = false;
  $('#ads-delete').textContent = order.source === 'public' ? 'Wycofaj ogłoszenie' : 'Usuń ogłoszenie';
  const remaining = order?.periods?.length ? Math.ceil(order.periods.reduce((sum, period) => sum + Math.max(0, Date.parse(period.actualEndAt || period.plannedEndAt || 0) - Math.max(Date.now(), Date.parse(period.actualStartAt || period.plannedStartAt || 0))),0) / 3600000) : order?.actualEndAt ? Math.max(0, Math.ceil((Date.parse(order.actualEndAt) - Date.now()) / 3600000)) : null;
  $('#ads-order-meta').innerHTML = order ? `<span><strong>Status:</strong> ${escape(labels[order.effectiveStatus]||order.effectiveStatus)}</span><span><strong>Źródło:</strong> ${order.source==='manual'?'Dodane ręcznie':'Zamówienie klienta'}</span><span><strong>Pakiet:</strong> ${escape(order.type)}</span><span><strong>Reklamodawca:</strong> ${escape(order.company||order.customerName||'—')}</span><span><strong>E-mail zamawiającego:</strong> ${escape(order.email||'—')}</span><span><strong>Język podstawowy:</strong> ${escape(order.primaryLanguage||order.language)}</span><span><strong>Języki:</strong> ${escape((order.languages||[order.language]).join(', '))}</span><span><strong>Kwota zamówienia:</strong> ${money(order.groupTotalPrice||order.totalPrice)}</span><span><strong>Płatność:</strong> ${escape(paymentLabel(order))}</span><span><strong>Planowany start:</strong> ${escape(order.plannedStartAt||'Po płatności i akceptacji')}</span><span><strong>Faktyczny start:</strong> ${escape(order.actualStartAt||'—')}</span><span><strong>Koniec:</strong> ${escape(order.actualEndAt||order.plannedEndAt||'—')}</span>${order.moderationReason?`<span><strong>Powód decyzji:</strong> ${escape(order.moderationReason)}</span>`:''}${order.refundId?`<span><strong>Zwrot Stripe:</strong> ${escape(order.refundId)}</span>`:''}${remaining === null ? '' : `<span><strong>Pozostało:</strong> ${remaining} h</span>`}${order.refundRequired?'<span class="danger">Wymaga sprawdzenia zwrotu</span>':''}` : '';
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
  $('#ads-edit-error').textContent = '';
  const preview = $('#ads-public-preview');
  preview.hidden = !['TOP','PREMIUM'].includes(order.type);
  preview.classList.toggle('ads-public-preview--premium', order.type === 'PREMIUM');
  $('#ads-image-preview').hidden = !order.image;
  if (order.image) $('#ads-image-preview').src = order.image;
  else $('#ads-image-preview').removeAttribute('src');
  $('#ads-preview-title').textContent = order.title || '';
  $('#ads-preview-description').textContent = order.description || '';
  $('#ads-preview-title').hidden = $('#ads-preview-description').hidden = order.type === 'PREMIUM' && !!order.image;
  $('#ads-preview-action').hidden = order.type !== 'TOP';
  $('#ads-dialog').showModal();
}
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
  if (!canModerate(order) || status !== 'approved') return;
  if (!await confirmAction('Zaakceptować ogłoszenie?', 'Ogłoszenie rozpocznie emisję w wybranym terminie.', 'Akceptuj')) return;
  button.disabled = true;
  try {
    const result = await api('admin-moderate-group', 'PUT', { id: order.id, version: order.version, status });
    if ($('#ads-dialog').open) $('#ads-dialog').close();
    await load();
    $('#ads-notice').textContent = 'Ogłoszenie zaakceptowane.' + (result.emailSent ? ' E-mail wysłany.' : ' E-mail nie został wysłany; sprawdź konfigurację poczty.');
  } catch (error) {
    const target = $('#ads-dialog').open ? $('#ads-edit-error') : $('#ads-notice');
    target.textContent = errorText(error);
  } finally { button.disabled = false; }
}
let decisionOrder = null, decisionKind = '';
$('#ads-decision-close').onclick = () => $('#ads-decision-dialog').close();
function openDecision(order, kind) {
  decisionOrder = order; decisionKind = kind;
  const refund = kind === 'reject' && order.source === 'public';
  $('#ads-decision-title').textContent = kind === 'changes' ? 'Poproś o poprawienie' : refund ? 'Odrzuć i zwróć pieniądze' : 'Odrzuć ogłoszenie';
  $('#ads-decision-hint').textContent = kind === 'changes' ? 'Podaj konkretne poprawki. Reklamodawca otrzyma bezpieczny link e-mail.' : refund ? 'Po potwierdzeniu system zleci pełny zwrot przez Stripe. Nie wykonuj tej operacji bez sprawdzenia powodu.' : 'Bezpłatne ogłoszenie zostanie odrzucone bez operacji Stripe.';
  $('#ads-decision-form').reset();
  if (order.status === 'refund_pending') $('#ads-decision-form').elements.reason.value = order.moderationReason || '';
  $('#ads-decision-error').textContent = '';
  if ($('#ads-dialog').open) $('#ads-dialog').close();
  $('#ads-decision-dialog').showModal();
}
$('#ads-decision-form').onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter, reason = event.target.elements.reason.value.trim();
  if (!decisionOrder || reason.length < 10) return;
  if (decisionKind === 'reject' && decisionOrder.source === 'public' && !await confirmAction('Zlecić pełny zwrot przez Stripe?', `Ogłoszenie ${decisionOrder.id} zostanie odrzucone. Powód: ${reason}`, 'Zleć zwrot')) return;
  button.disabled = true;
  try {
    const body = { id: decisionOrder.id, version: decisionOrder.version, reason };
    const result = decisionKind === 'changes' ? await api('admin-request-changes', 'PUT', body) : decisionOrder.source === 'public' ? await api('admin-reject-refund', 'PUT', body) : await api('admin-moderate-group', 'PUT', { ...body, status: 'rejected' });
    $('#ads-decision-dialog').close();
    await load();
    $('#ads-notice').textContent = (decisionKind === 'changes' ? 'Prośba o poprawki zapisana.' : decisionOrder.source === 'public' ? 'Zwrot zlecony w Stripe. Oczekujemy na potwierdzenie webhooka.' : 'Bezpłatne ogłoszenie odrzucone.') + (result.emailSent ? ' E-mail wysłany.' : ' E-mail nie został wysłany; sprawdź konfigurację poczty.');
  } catch (error) { $('#ads-decision-error').textContent = errorText(error); }
  finally { button.disabled = false; }
};
for (const selector of ['#ads-orders', '#ads-moderation-actions']) $(selector).addEventListener('click', event => {
  const action = event.target.closest('[data-ad-moderate]');
  if (action) { moderate(orders.find(order => order.id === action.dataset.adId), action.dataset.adModerate, action); return; }
  const decision = event.target.closest('[data-ad-decision]'); if (decision) { openDecision(orders.find(order => order.id === decision.dataset.adId), decision.dataset.adDecision); return; }
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
$('#ads-display-settings').onsubmit = async event => {
  event.preventDefault(); if (!configuration) return;
  const button = event.submitter; button.disabled = true;
  const notice = $('#ads-display-notice'); notice.textContent = '';
  try {
    const values = Object.fromEntries(new FormData(event.target));
    const data = structuredClone(configuration.data);
    data.display.STANDARD = { visible:Number(values.standardVisible), seconds:Number(values.standardSeconds) };
    data.display.TOP = { visible:Number(values.topVisible), seconds:Number(values.topSeconds) };
    data.display.PREMIUM.maxItems = Number(values.premiumMaxItems);
    data.display.PREMIUM.seconds = Number(values.premiumSeconds);
    data.display.PREMIUM.placeholder.enabled = values.placeholderEnabled === 'on';
    for (const language of ['pl','nl','fr']) data.display.PREMIUM.placeholder.locales[language] = {
      title:values[`placeholder-${language}-title`].trim(),
      description:values[`placeholder-${language}-description`].trim(),
      image:values[`placeholder-${language}-image`].trim()
    };
    const saved = await api('admin-settings','PUT',{ data, version:configuration.version });
    configuration = { ...configuration, ...saved };
    notice.textContent = 'Ustawienia wyświetlania zapisano. Strona odczyta je bez nowego wdrożenia.';
  } catch (error) { notice.textContent = errorText(error); } finally { button.disabled = false; }
};
async function showCapacity() {
  const values = Object.fromEntries(new FormData($('#ads-capacity')));
  const target = $('#ads-capacity-results');
  try {
    const result = await api('admin-capacity', 'GET', null, values);
    target.innerHTML = `<p>Limit podstawowy · zajęte · rezerwa · udostępnione · dostępne</p><div class="table-scroll"><table class="data-table"><tbody>${result.days.map(day => `<tr><th>${escape(day.date)}</th><td>${day.base}</td><td>${day.used}</td><td>${day.reserve}</td><td>${day.released}</td><td>${day.remaining}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) { target.textContent = errorText(error); }
}
$('#ads-capacity-check').onclick = showCapacity;
$('#ads-mail-check').onclick = async event => {
  const button = event.currentTarget; button.disabled = true;
  const result = $('#ads-mail-result'); result.textContent = 'Wysyłanie wiadomości kontrolnej…';
  try { await api('admin-mail-check', 'POST', {}); result.textContent = 'Serwer pocztowy przyjął wiadomość. Sprawdź skrzynkę kontakt@polacywbelgii.eu.'; }
  catch (error) { result.textContent = errorText(error); }
  finally { button.disabled = false; }
};
$('#ads-capacity').onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(event.target));
    const start = Date.parse(values.startDate), end = Date.parse(values.endDate);
    const days = Math.round((end - start) / 86400000) + 1;
    if (!Number.isSafeInteger(days) || days < 1 || days > 90 || values.startDate < configuration.today) throw { code: 'dates' };
    const dates = Array.from({ length: days }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10));
    const saved = await api('admin-capacity', 'PUT', { version: configuration.version, language: values.language, type: values.type, dates, reserve: Number(values.reserve), released: Number(values.released) });
    configuration.version = saved.version;
    $('#ads-notice').textContent = 'Dodatkowe miejsca zapisane.';
    await showCapacity();
  } catch (error) { $('#ads-capacity-results').textContent = errorText(error); }
  finally { button.disabled = false; }
};
function applyLanguage() {const language=document.querySelector('#cms-language').value;document.querySelectorAll('#ads-prices fieldset').forEach((f,i)=>f.hidden=Object.keys(configuration.languages)[i]!==language);}
document.addEventListener('cmslanguagechange',()=>{if(configuration){applyLanguage();render();}});
