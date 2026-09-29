import { cmsRequest } from './modules/client.js';
const $ = selector => document.querySelector(selector);
const labels = { pending: 'Oczekuje', approved: 'Zaakceptowane', scheduled: 'Zaplanowane', active: 'Aktywne', ended: 'Zakończone', rejected: 'Odrzucone', cancelled: 'Anulowane' };
const errors = { unavailable: 'API reklam jest niedostępne. Sprawdź DATABASE_URL i migrację bazy.', unauthorized: 'Brak uprawnień. Zaloguj się ponownie.', dates: 'Niepoprawny zakres dat (maks. 366 dni, do 2 lat naprzód).', settings: 'Wprowadź poprawne ceny. Włączony rynek wymaga cen większych od zera.', validation: 'Sprawdź dane formularza.', image: 'Wymagany poprawny PNG/JPEG/WebP do 500 KB.', conflict: 'Ktoś zmienił dane. Odśwież listę przed ponowną edycją.', full: 'Brak miejsc:', immutableMarket: 'Nie można zmienić języka ani typu istniejącego zamówienia.', market: 'Niepoprawny rynek.' };
let configuration, orders = [], editing = null;
const isShowcase = order => order?.demoSet === 'showcase-2026-09-29' && order.source === 'manual' && order.paymentStatus === 'not_required';
const money = value => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'EUR' }).format(value / 100);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const errorText = error => (errors[error.code] || error.message || 'Nie udało się zapisać.') + (error.details ? ' ' + error.details.map(day => `${day.date}: zajęte ${day.used}/${day.capacity}`).join(', ') : '');
async function api(action, method = 'GET', body, params = {}) {
  return cmsRequest('ads', { action, ...params }, method, body);
}
async function load() {
  $('#ads-notice').textContent = 'Ładowanie…';
  try {
    const [settings, result] = await Promise.all([api('admin-settings'), api('admin-orders')]);
    configuration = settings; orders = result.orders;
    $('#ads-prices').innerHTML = Object.entries(settings.languages).map(([key, language]) => `<fieldset><legend>${escape(language.name)}</legend><div class="form-grid"><label>Zamówienia<select name="${key}-enabled"><option value="false">Wyłączone</option><option value="true" ${settings.data.markets[key].enabled ? 'selected' : ''}>Włączone</option></select></label>${Object.keys(settings.data.types).map(type => `<label>${escape(type)} / dzień (EUR)<input name="${key}-${type}" type="number" min="0" max="10000" step="0.01" required value="${settings.data.markets[key].prices[type] / 100}"></label>`).join('')}</div></fieldset>`).join('');
    for (const form of [$('#ads-filters'), $('#ads-edit')]) {
      const select = form.elements.namedItem('language'); const previous = select.value;
      select.innerHTML = (form.id === 'ads-filters' ? '<option value="">Wszystkie</option>' : '') + Object.entries(settings.languages).map(([key, language]) => `<option value="${escape(key)}">${escape(language.name)}</option>`).join('');
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
    }
    applyLanguage(); render(); $('#ads-notice').textContent = '';
  } catch (error) { $('#ads-notice').textContent = errorText(error); }
}
function render() {
  const filter = Object.fromEntries(new FormData($('#ads-filters')));
  const filtered = orders.filter(order => (!filter.language || filter.language === order.language) && (!filter.type || filter.type === order.type) && (!filter.status || (filter.status === 'approved' ? order.status === 'approved' : filter.status === order.effectiveStatus)) && (!filter.from || isShowcase(order) || order.endDate >= filter.from) && (!filter.to || order.startDate <= filter.to));
  $('#ads-orders').innerHTML = filtered.map(order => `<div class="table-row"><div><h3>${escape(order.title)}</h3><p>${escape(order.company)} · ${escape(order.language.toUpperCase())} · ${escape(order.type)} · ${labels[order.effectiveStatus]}</p><p>${escape(order.startDate)} — ${isShowcase(order) ? 'Bezterminowo (pokazowe)' : escape(order.endDate)} · ${order.days} dni × ${money(order.dailyPrice)} = ${money(order.totalPrice)}</p></div><button class="secondary" data-ad-edit="${escape(order.id)}">Szczegóły / edycja</button></div>`).join('') || '<p>Brak zamówień spełniających kryteria.</p>';
}
function editPrice() {
  if (isShowcase(editing)) { $('#ads-edit-price').textContent = 'Bezterminowo (pokazowe). Aby ukryć, wybierz status Anulowane.'; return; }
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
  $('#ads-delete').hidden = !order;
  const input = order || { language: Object.keys(configuration.languages)[0], type: 'STANDARD', status: 'approved', startDate: configuration.today, endDate: configuration.today };
  for (const [key, value] of Object.entries(input)) { const control = form.elements.namedItem(key); if (control) control.value = value; }
  form.elements.language.disabled = form.elements.type.disabled = Boolean(order);
  for (const key of ['startDate', 'endDate']) { form.elements[key].readOnly = isShowcase(order); form.elements[key].closest('label').hidden = isShowcase(order); }
  const textOnly=!order || order.kind==='text';
  for(const key of ['company','title','url','customerName','imageFile']) { form.elements[key].required=!textOnly && (key!=='imageFile'||!order); form.elements[key].closest('label').hidden=textOnly; }
  $('#ads-contact-label').hidden=!textOnly; form.elements.contact.required=textOnly;
  form.elements.imageFile.required = !textOnly && !order;
  $('#ads-free-label').hidden = Boolean(order);
  $('#ads-order-meta').textContent = order ? `${order.id} · ${labels[order.effectiveStatus]} · ${order.source === 'manual' ? 'Dodane ręcznie' : 'Zamówienie klienta'} · ${order.days} dni × ${money(order.dailyPrice)} = ${money(order.totalPrice)}` : 'Nowa reklama';
  $('#ads-edit-error').textContent = ''; $('#ads-image-preview').hidden = !order || textOnly;
  if (order) $('#ads-image-preview').src = order.image;
  editPrice(); $('#ads-dialog').showModal();
}
$('#ads-edit').addEventListener('change', editPrice);
$('#ads-new').onclick = () => open();
$('#ads-close').onclick = () => $('#ads-dialog').close();
$('#ads-delete').onclick = async () => {
  if (!editing || !confirm('Usunąć to ogłoszenie? Zniknie ze strony i zwolni zarezerwowane miejsca. Tej operacji nie można cofnąć.')) return;
  const button = $('#ads-delete'); button.disabled = true;
  try { await api('admin-order', 'DELETE', { id: editing.id, version: editing.version }); $('#ads-dialog').close(); await load(); $('#ads-notice').textContent = 'Ogłoszenie usunięte.'; }
  catch (error) { $('#ads-edit-error').textContent = errorText(error); }
  finally { button.disabled = false; }
};
$('#ads-orders').onclick = event => { const button = event.target.closest('[data-ad-edit]'); if (button) open(orders.find(order => order.id === button.dataset.adEdit)); };
$('#ads-filters').onchange = render;
$('#ads-refresh').onclick = load;
$('[data-view="ads"]').addEventListener('click', load);
$('#ads-settings').onsubmit = async event => {
  event.preventDefault(); if (!configuration) return;
  const button = event.submitter; button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(event.target)); const data = structuredClone(configuration.data);
    for (const language of Object.keys(configuration.languages)) {
      data.markets[language].enabled = values[`${language}-enabled`] === 'true';
      for (const type of Object.keys(data.types)) data.markets[language].prices[type] = Math.round(Number(values[`${language}-${type}`]) * 100);
    }
    const saved = await api('admin-settings', 'PUT', { data, version: configuration.version }); configuration = { ...configuration, ...saved };
    $('#ads-notice').textContent = 'Cennik zapisany. Obowiązuje od razu. Istniejące zamówienia zachowują ceny.';
  } catch (error) { $('#ads-notice').textContent = errorText(error); } finally { button.disabled = false; }
};
$('#ads-edit').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const form = event.target; const values = Object.fromEntries(new FormData(form)); const file = form.elements.imageFile.files[0];
    let image = editing?.image;
    if (file) {
      if (file.size > 512000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw { code: 'image' };
      image = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    }
    await api('admin-order', editing ? 'PUT' : 'POST', { ...values, kind: editing ? editing.kind : 'text', imageFile: undefined, image, language: editing?.language || values.language, type: editing?.type || values.type, id: editing?.id, version: editing?.version, complimentary: values.complimentary === 'true' });
    $('#ads-dialog').close(); await load(); $('#ads-notice').textContent = 'Reklama zapisana.';
  } catch (error) { $('#ads-edit-error').textContent = errorText(error); } finally { button.disabled = false; }
};

function applyLanguage() {const language=document.querySelector('#cms-language').value;$('#ads-filters').elements.language.value=language;document.querySelectorAll('#ads-prices fieldset').forEach((f,i)=>f.hidden=Object.keys(configuration.languages)[i]!==language);}
document.addEventListener('cmslanguagechange',()=>{if(configuration){applyLanguage();render();}});
