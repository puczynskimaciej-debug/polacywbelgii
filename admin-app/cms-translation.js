import { cmsRequest } from './modules/client.js';
import { confirmAction } from './ui.js';

const fieldsFor = kind => kind === 'article' ? ['title', 'description', 'body', 'tags'] : ['title', 'description', 'body'];
const sourceName = (kind, key) => key === 'tags' && kind === 'article' ? 'tags_pl' : key;
const translationName = (kind, key, language) => key === 'tags' && kind === 'article' ? `tags_${language}` : `${key}_${language}`;

export function setupTranslations(form, kind) {
  const status = document.createElement('p');
  status.className = 'cms-translation-status';
  status.setAttribute('role', 'status');
  form.querySelector('.language-tabs').after(status);
  const fields = fieldsFor(kind);
  let busy = false;
  const baseline = new Map();
  const markers = new Map();
  const controls = [];

  function reset() {
    status.textContent = '';
    for (const key of fields) for (const language of ['nl', 'fr']) baseline.set(`${key}_${language}`, form.elements[sourceName(kind, key)].value);
    for (const marker of markers.values()) marker.hidden = true;
  }
  function markStale(key) {
    for (const language of ['nl', 'fr']) {
      const marker = markers.get(`${key}_${language}`);
      const changed = form.elements[sourceName(kind, key)].value !== baseline.get(`${key}_${language}`);
      marker.hidden = !changed || !form.elements[translationName(kind, key, language)].value.trim();
    }
  }
  async function translate(language, keys) {
    if (busy) return;
    const values = Object.fromEntries(keys.map(key => [key, form.elements[sourceName(kind, key)].value]).filter(([, value]) => value.trim()));
    if (!Object.keys(values).length) { status.textContent = 'Wpisz polską treść do tłumaczenia.'; return; }
    busy = true; controls.forEach(button => button.disabled = true);
    try {
      const occupied = Object.keys(values).filter(key => form.elements[translationName(kind, key, language)].value.trim());
      if (occupied.length && !await confirmAction('Nadpisać tłumaczenie?', `Istniejąca treść ${language.toUpperCase()} w polach: ${occupied.join(', ')} zostanie zastąpiona.`, 'Tłumacz')) return;
      status.textContent = `Tłumaczenie na ${language.toUpperCase()} trwa…`;
      const result = await cmsRequest('ai-translation', {}, 'POST', { kind, language, fields: values });
      for (const [key, value] of Object.entries(result.fields)) {
        form.elements[translationName(kind, key, language)].value = value;
        baseline.set(`${key}_${language}`, values[key]);
        markStale(key);
      }
      status.textContent = `Tłumaczenie na ${language.toUpperCase()} jest gotowe. Sprawdź je i zapisz formularz.`;
      form.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) { status.textContent = `Nie udało się przetłumaczyć: ${error.message}`; }
    finally { busy = false; controls.forEach(button => button.disabled = false); }
  }

  for (const language of ['nl', 'fr']) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'secondary cms-translate-button';
    button.textContent = `Tłumacz całość na ${language.toUpperCase()}`;
    button.addEventListener('click', () => translate(language, fields));
    form.querySelector('.language-tabs').append(button); controls.push(button);
  }
  for (const key of fields) {
    const input = form.elements[sourceName(kind, key)];
    const actions = document.createElement('span'); actions.className = 'cms-translate-field-actions';
    for (const language of ['nl', 'fr']) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ghost cms-translate-button';
      button.textContent = `Tłumacz na ${language.toUpperCase()}`;
      button.addEventListener('click', () => translate(language, [key]));
      actions.append(button); controls.push(button);
      const target = form.elements[translationName(kind, key, language)];
      const marker = document.createElement('small'); marker.className = 'cms-translation-stale'; marker.textContent = 'Może wymagać aktualizacji'; marker.hidden = true;
      target.closest('label').append(marker); markers.set(`${key}_${language}`, marker);
    }
    input.closest('label, .event-body-field').append(actions);
    input.addEventListener('input', () => markStale(key));
  }
  return { reset };
}
