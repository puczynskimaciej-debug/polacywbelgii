(() => {
  const form = document.querySelector('#ad-correction-form');
  if (!form) return;
  const status = document.querySelector('#ad-correction-status');
  const groupId = new URLSearchParams(location.search).get('order');
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  history.replaceState(null, '', location.pathname + location.search);
  const limits = { PREMIUM: { title: 70, description: 200 }, TOP: { title: 60, description: 160 }, STANDARD: { title: 70, description: 500 } };
  let preview;
  const node = (tag, text) => { const item = document.createElement(tag); if (text) item.textContent = text; return item; };
  const label = (text, control) => { const item = node('label', text); item.append(control); return item; };
  const input = (name, value, max) => { const field = node('input'); field.name = name; field.value = value || ''; if (max) field.maxLength = max; return field; };
  async function api(action, body) {
    const response = await fetch(`/api/ads?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'requestFailed');
    return data;
  }
  async function load() {
    if (!groupId || !token) { status.textContent = 'Link jest nieprawidłowy lub wygasł.'; return; }
    try {
      preview = await api('customer-preview', { groupId, token });
      const container = document.querySelector('#ad-correction-fields');
      container.replaceChildren();
      container.append(node('p', `Pakiet: ${preview.type}. Terminy: ${preview.dates.join(', ')}. Powód poprawki: ${preview.reason}`));
      for (const variant of preview.variants) {
        const block = node('fieldset'); block.className = 'order-panel'; block.dataset.language = variant.language;
        block.append(node('legend', `Wersja ${variant.language.toUpperCase()}`));
        const title = input('title', variant.title, limits[preview.type].title); title.required = true;
        const description = node('textarea'); description.name = 'description'; description.value = variant.description || ''; description.maxLength = limits[preview.type].description; description.required = true; description.rows = 4;
        block.append(label('Tytuł', title), label('Opis', description));
        if (preview.kind === 'image') {
          const artwork = node('input'); artwork.type = 'file'; artwork.name = 'image'; artwork.accept = 'image/png,image/jpeg,image/webp';
          block.append(label('Nowa grafika (opcjonalnie)', artwork));
          if (preview.type === 'PREMIUM') { const mobile = node('input'); mobile.type = 'file'; mobile.name = 'imageMobile'; mobile.accept = artwork.accept; block.append(label('Nowa grafika mobilna (opcjonalnie)', mobile)); }
        }
        container.append(block);
      }
      for (const key of ['company', 'publicPhone', 'publicEmail', 'contact', 'url']) form.elements[key].value = preview[key] || '';
      form.hidden = false;
      status.textContent = 'Zmień wskazane dane i wyślij ogłoszenie do ponownej moderacji.';
    } catch { status.textContent = 'Link jest nieprawidłowy lub wygasł.'; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    status.textContent = 'Zapisywanie poprawek…';
    try {
      const variants = await Promise.all([...form.querySelectorAll('[data-language]')].map(async block => {
        const original = preview.variants.find(item => item.language === block.dataset.language);
        const variant = { language: original.language, title: block.querySelector('[name=title]').value, description: block.querySelector('[name=description]').value };
        if (preview.kind === 'image') {
          variant.image = block.querySelector('[name=image]').files[0] ? await window.PbeFitAdImage(block.querySelector('[name=image]').files[0], 1200, preview.type === 'PREMIUM' ? 200 : 720) : original.image;
          if (preview.type === 'PREMIUM') variant.imageMobile = block.querySelector('[name=imageMobile]').files[0] ? await window.PbeFitAdImage(block.querySelector('[name=imageMobile]').files[0], 660, 300) : original.imageMobile;
        }
        return variant;
      }));
      const publicData = Object.fromEntries(['company', 'publicPhone', 'publicEmail', 'contact', 'url'].map(key => [key, form.elements[key].value]));
      await api('customer-correct', { groupId, token, variants, ...publicData });
      form.hidden = true;
      status.textContent = 'Dziękujemy. Poprawione ogłoszenie wróciło do moderacji.';
    } catch { status.textContent = 'Nie udało się zapisać zmian. Sprawdź dane i spróbuj ponownie.'; }
    finally { button.disabled = false; }
  });
  load();
})();
