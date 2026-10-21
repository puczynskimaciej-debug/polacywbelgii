(() => {
  const copy = {
    pl: {
      title: 'Zamów ogłoszenie', intro: 'Wybierz języki, miejsce, format i termin. Dostępność oraz cenę sprawdzisz przed wysłaniem.',
      languages: '1. Języki ogłoszenia', placement: '2. Miejsce publikacji', top: 'TOP — wyróżnione ogłoszenia', standard: 'STANDARD — sekcja ogłoszeń', premium: 'PREMIUM — baner na samej górze strony',
      format: '3. Format reklamy', text: 'Ogłoszenie tekstowe', banner: 'Baner graficzny', dates: '4. Termin publikacji',
      hint: 'Wybierz pierwszy i ostatni dzień w kalendarzu lub użyj pól daty. Szare dni są zajęte. Maksymalnie 90 kolejnych dni.',
      from: 'Od', to: 'Do (włącznie)', pickEnd: 'Wybierz ostatni dzień', free: 'wolne',
      textContent: '5. Treść ogłoszenia', bannerContent: '5. Treść banera', textPrompt: 'Treść ogłoszenia', bannerTitle: 'Tytuł', bannerDescription: 'Krótki opis',
      company: 'Firma / reklamodawca', url: 'Adres strony reklamy', image: 'Baner (PNG, JPEG lub WebP, do 500 KB)', customer: 'Imię i nazwisko zamawiającego',
      contact: 'Kontakt widoczny pod ogłoszeniem', contactHint: 'Telefon, e-mail lub adres — wpisz tylko to, co chcesz upublicznić.',
      email: 'Twój e-mail — tylko dla administratorów', privacy: 'Ten adres służy do obsługi zamówienia i nie pojawi się w ogłoszeniu.',
      consent: 'Zgadzam się na publikację treści i przetwarzanie podanych danych w celu obsługi zamówienia.', total: 'Łącznie', days: 'Wybrane dni',
      review: 'Sprawdź zamówienie', send: 'Złóż zamówienie', back: 'Wróć do edycji', close: 'Zamknij', loading: 'Sprawdzanie dostępności…',
      unavailable: 'Zamawianie w wybranym języku jest obecnie wyłączone.', error: 'Nie udało się pobrać danych. Spróbuj ponownie.',
      full: 'Wybrany termin obejmuje zajęte dni. Wybierz inny zakres.', changed: 'Cena zmieniła się. Sprawdź nową cenę.',
      imageError: 'Wybierz plik PNG, JPEG lub WebP do 500 KB.', success: 'Zamówienie zapisane i czeka na akceptację redakcji.',
      unpaid: 'Płatności online nie są jeszcze dostępne. Teraz nic nie płacisz.', empty: 'Wybierz dostępny zakres dat.',
      previous: 'Poprzedni miesiąc', next: 'Następny miesiąc', limit: 'Możesz wybrać maksymalnie 90 kolejnych dni.',
      demoNotice: 'Tryb demonstracyjny — ceny i dostępność są przykładowe. Nic nie zostanie zapisane.', demoSuccess: 'To był podgląd zamówienia. Nic nie zostało wysłane.'
    },
    en: {
      title: 'Order a listing', intro: 'Choose languages, placement, format and dates. Check availability and price before submitting.',
      languages: '1. Listing languages', placement: '2. Placement', top: 'TOP — featured listings', standard: 'STANDARD — listings section', premium: 'PREMIUM — banner at the very top of the page',
      format: '3. Ad format', text: 'Text listing', banner: 'Image banner', dates: '4. Publication dates',
      hint: 'Choose the first and last day in the calendar or use the date fields. Grey days are fully booked. Up to 90 consecutive days.',
      from: 'From', to: 'To (inclusive)', pickEnd: 'Choose the last day', free: 'free',
      textContent: '5. Listing text', bannerContent: '5. Banner content', textPrompt: 'Listing text', bannerTitle: 'Title', bannerDescription: 'Short description',
      company: 'Company / advertiser', url: 'Advertiser website', image: 'Banner (PNG, JPEG or WebP, up to 500 KB)', customer: 'Customer name',
      contact: 'Contact details shown with the listing', contactHint: 'Phone, email or address — enter only what you want to make public.',
      email: 'Your email — visible to administrators only', privacy: 'This address is used to handle your order and is not shown in the listing.',
      consent: 'I agree to publication of the content and processing of my details to handle this order.', total: 'Total', days: 'Selected days',
      review: 'Review order', send: 'Submit order', back: 'Back to editing', close: 'Close', loading: 'Checking availability…',
      unavailable: 'Orders are currently disabled for the chosen language.', error: 'Could not load the data. Please try again.',
      full: 'The chosen range contains fully booked days. Choose another range.', changed: 'The price changed. Review the new total.',
      imageError: 'Choose a PNG, JPEG or WebP file up to 500 KB.', success: 'Your order was saved and is awaiting editorial approval.',
      unpaid: 'Online payments are not available yet. You do not pay anything now.', empty: 'Choose an available date range.',
      previous: 'Previous month', next: 'Next month', limit: 'You can select up to 90 consecutive days.',
      demoNotice: 'Demo mode — prices and availability are examples. Nothing will be saved.', demoSuccess: 'This was an order preview. Nothing was submitted.'
    },
    nl: {
      title: 'Plaats een advertentie', intro: 'Kies talen, plaatsing, formaat en periode. Bekijk de beschikbaarheid en prijs voor verzending.',
      languages: '1. Talen van de advertentie', placement: '2. Plaatsing', top: 'TOP — uitgelichte advertenties', standard: 'STANDARD — advertentierubriek', premium: 'PREMIUM — banner helemaal bovenaan de pagina',
      format: '3. Advertentieformaat', text: 'Tekstadvertentie', banner: 'Afbeeldingsbanner', dates: '4. Publicatieperiode',
      hint: 'Kies de eerste en laatste dag in de kalender of gebruik de datumvelden. Grijze dagen zijn volzet. Maximaal 90 opeenvolgende dagen.',
      from: 'Van', to: 'Tot en met', pickEnd: 'Kies de laatste dag', free: 'vrij',
      textContent: '5. Advertentietekst', bannerContent: '5. Bannerinhoud', textPrompt: 'Advertentietekst', bannerTitle: 'Titel', bannerDescription: 'Korte beschrijving',
      company: 'Bedrijf / adverteerder', url: 'Website van de adverteerder', image: 'Banner (PNG, JPEG of WebP, maximaal 500 KB)', customer: 'Naam van de klant',
      contact: 'Contactgegevens bij de advertentie', contactHint: 'Telefoon, e-mail of adres — vul alleen in wat openbaar mag zijn.',
      email: 'Je e-mail — alleen voor beheerders', privacy: 'Dit adres wordt gebruikt voor je bestelling en niet getoond in de advertentie.',
      consent: 'Ik stem in met publicatie van de inhoud en verwerking van mijn gegevens voor deze bestelling.', total: 'Totaal', days: 'Geselecteerde dagen',
      review: 'Controleer bestelling', send: 'Bestelling plaatsen', back: 'Terug naar bewerken', close: 'Sluiten', loading: 'Beschikbaarheid controleren…',
      unavailable: 'Bestellen is momenteel uitgeschakeld voor de gekozen taal.', error: 'Gegevens laden mislukt. Probeer opnieuw.',
      full: 'De gekozen periode bevat volzette dagen. Kies een andere periode.', changed: 'De prijs is gewijzigd. Controleer het nieuwe bedrag.',
      imageError: 'Kies een PNG-, JPEG- of WebP-bestand van maximaal 500 KB.', success: 'De bestelling is opgeslagen en wacht op goedkeuring.',
      unpaid: 'Online betalen is nog niet beschikbaar. Je betaalt nu niets.', empty: 'Kies een beschikbare periode.',
      previous: 'Vorige maand', next: 'Volgende maand', limit: 'Je kunt maximaal 90 opeenvolgende dagen kiezen.',
      demoNotice: 'Demomodus — prijzen en beschikbaarheid zijn voorbeelden. Er wordt niets opgeslagen.', demoSuccess: 'Dit was een voorbeeld. Er is niets verzonden.'
    },
    fr: {
      title: 'Publier une annonce', intro: 'Choisissez les langues, l’emplacement, le format et la période. Vérifiez la disponibilité et le prix avant l’envoi.',
      languages: '1. Langues de l’annonce', placement: '2. Emplacement', top: 'TOP — annonces mises en avant', standard: 'STANDARD — rubrique annonces', premium: 'PREMIUM — bannière tout en haut de la page',
      format: '3. Format de l’annonce', text: 'Annonce textuelle', banner: 'Bannière illustrée', dates: '4. Période de publication',
      hint: 'Choisissez le premier et le dernier jour dans le calendrier ou utilisez les champs de date. Les jours gris sont complets. 90 jours consécutifs maximum.',
      from: 'Du', to: 'Au (inclus)', pickEnd: 'Choisissez le dernier jour', free: 'libres',
      textContent: '5. Texte de l’annonce', bannerContent: '5. Contenu de la bannière', textPrompt: 'Texte de l’annonce', bannerTitle: 'Titre', bannerDescription: 'Brève description',
      company: 'Entreprise / annonceur', url: 'Site de l’annonceur', image: 'Bannière (PNG, JPEG ou WebP, 500 Ko maximum)', customer: 'Nom du client',
      contact: 'Coordonnées affichées avec l’annonce', contactHint: 'Téléphone, e-mail ou adresse — indiquez uniquement ce qui peut être public.',
      email: 'Votre e-mail — réservé aux administrateurs', privacy: 'Cette adresse sert à gérer la commande et n’apparaît pas dans l’annonce.',
      consent: 'J’accepte la publication du contenu et le traitement de mes données pour gérer cette commande.', total: 'Total', days: 'Jours sélectionnés',
      review: 'Vérifier la commande', send: 'Envoyer la commande', back: 'Retour à la modification', close: 'Fermer', loading: 'Vérification des disponibilités…',
      unavailable: 'Les commandes sont actuellement désactivées pour la langue choisie.', error: 'Impossible de charger les données. Réessayez.',
      full: 'La période choisie contient des jours complets. Choisissez une autre période.', changed: 'Le prix a changé. Vérifiez le nouveau montant.',
      imageError: 'Choisissez un fichier PNG, JPEG ou WebP de 500 Ko maximum.', success: 'La commande a été enregistrée et attend la validation de la rédaction.',
      unpaid: 'Le paiement en ligne n’est pas encore disponible. Vous ne payez rien maintenant.', empty: 'Choisissez une période disponible.',
      previous: 'Mois précédent', next: 'Mois suivant', limit: 'Vous pouvez choisir 90 jours consécutifs au maximum.',
      demoNotice: 'Mode démonstration — prix et disponibilités fictifs. Rien ne sera enregistré.', demoSuccess: 'Ceci était un aperçu. Rien n’a été envoyé.'
    }
  };

  Object.assign(copy.pl, { topImage: 'Grafika TOP: 1200 × 720 px (PNG, JPEG lub WebP, do 500 KB).', premiumImage: 'Grafika PREMIUM: komputer 1200 × 200 px i telefon 660 × 300 px. Każdy plik PNG, JPEG lub WebP, do 500 KB.', mobileImage: 'Grafika na telefon (660 × 300 px)', dimensionError: 'Grafika ma inne wymiary niż wymagane dla wybranego miejsca publikacji.' });
  Object.assign(copy.en, { topImage: 'TOP image: 1200 × 720 px (PNG, JPEG or WebP, up to 500 KB).', premiumImage: 'PREMIUM images: desktop 1200 × 200 px and mobile 660 × 300 px. Each PNG, JPEG or WebP, up to 500 KB.', mobileImage: 'Mobile image (660 × 300 px)', dimensionError: 'The image dimensions do not match the selected placement.' });
  Object.assign(copy.nl, { topImage: 'TOP-afbeelding: 1200 × 720 px (PNG, JPEG of WebP, maximaal 500 KB).', premiumImage: 'PREMIUM-afbeeldingen: desktop 1200 × 200 px en mobiel 660 × 300 px. Elk PNG, JPEG of WebP, maximaal 500 KB.', mobileImage: 'Mobiele afbeelding (660 × 300 px)', dimensionError: 'De afbeelding heeft niet de vereiste afmetingen voor deze plaatsing.' });
  Object.assign(copy.fr, { topImage: 'Image TOP : 1200 × 720 px (PNG, JPEG ou WebP, 500 Ko maximum).', premiumImage: 'Images PREMIUM : ordinateur 1200 × 200 px et mobile 660 × 300 px. Chaque fichier PNG, JPEG ou WebP, 500 Ko maximum.', mobileImage: 'Image mobile (660 × 300 px)', dimensionError: 'Les dimensions de l’image ne correspondent pas à cet emplacement.' });
  const languages = window.siteLanguages;
  const keys = Object.keys(languages);
  const names = keys.map(key => languages[key].name);
  const dialog = document.createElement('dialog');
  dialog.id = 'order-dialog';
  dialog.setAttribute('aria-labelledby', 'order-title');
  document.body.append(dialog);

  let config, selectedLanguages = ['pl'], type = 'TOP', kind = 'text', month = '';
  let startDate = '', endDate = '', drafts = {}, titles = {}, descriptions = {};
  let contact = '', email = '', company = '', url = '', customerName = '', imageData = '', imageName = '', mobileImageData = '', mobileImageName = '';
  let requestId = crypto.randomUUID(), version = 0, pending = false, restoreFocus, locale = 'pl';
  let demoMode = false, demoRequest;
  const $ = selector => dialog.querySelector(selector);
  const t = key => (copy[locale] || copy.pl)[key];
  const node = (tag, value = '', className = '') => { const element = document.createElement(tag); element.textContent = value; if (className) element.className = className; return element; };
  const dateAt = (date, offset) => new Date(Date.parse(date) + offset * 86400000).toISOString().slice(0, 10);
  const range = (first, last) => { const days = []; for (let date = first; date <= last && days.length < 91; date = dateAt(date, 1)) days.push(date); return days; };
  const money = cents => new Intl.NumberFormat(languages[locale]?.locale || 'pl-PL', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  async function api(action, params = {}, body) {
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      demoRequest ||= fetch('/local-demo-order.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).catch(() => null);
      const demo = await demoRequest;
      if (demo) {
        demoMode = true;
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
        if (action === 'config') return { ...demo, languages, today };
        if (action === 'availability') {
          const capacity = demo.data.types[params.type]?.capacity || 0;
          const daysAvailable = [];
          for (let date = params.startDate; date <= params.endDate; date = dateAt(date, 1)) {
            const booked = (params.type === 'TOP' && date === dateAt(today, 2)) || (params.type === 'PREMIUM' && date === dateAt(today, 3)) ? capacity : 0;
            daysAvailable.push({ date, remaining: capacity - booked });
          }
          return { enabled: demo.data.markets[params.language]?.enabled === true && (params.type !== 'PREMIUM' || demo.data.markets[params.language]?.prices.PREMIUM > 0), daysAvailable };
        }
        if (action === 'order-batch') return { demo: true };
      }
    }
    const response = await fetch('/.netlify/functions/ads?' + new URLSearchParams({ action, ...params }), body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }

  function capture() {
    dialog.querySelectorAll('[data-copy]').forEach(field => { drafts[field.dataset.copy] = field.value; });
    dialog.querySelectorAll('[data-title]').forEach(field => { titles[field.dataset.title] = field.value; });
    dialog.querySelectorAll('[data-description]').forEach(field => { descriptions[field.dataset.description] = field.value; });
    contact = $('[name=contact]')?.value ?? contact;
    email = $('[name=email]')?.value ?? email;
    company = $('[name=company]')?.value ?? company;
    url = $('[name=url]')?.value ?? url;
    customerName = $('[name=customerName]')?.value ?? customerName;
  }
  function total() {
    if (!config || !endDate || !type) return 0;
    return range(startDate, endDate).length * selectedLanguages.reduce((sum, language) => sum + (config.data.markets[language]?.prices[type] || 0), 0);
  }
  function summary() {
    if (!$('#order-start')) return;
    $('#order-start').value = startDate;
    $('#order-end').value = endDate;
    $('#chosen-days').textContent = endDate ? String(range(startDate, endDate).length) : startDate ? t('pickEnd') : '—';
    $('#order-total').textContent = money(total());
    $('#order-review').disabled = !startDate || !endDate || !selectedLanguages.length || !type || !config || (kind === 'image' && (!imageData || (type === 'PREMIUM' && !mobileImageData)));
    dialog.querySelectorAll('#order-calendar button[data-date]').forEach(button => {
      const date = button.dataset.date;
      button.setAttribute('aria-pressed', String(!!startDate && date >= startDate && date <= (endDate || startDate)));
      button.classList.toggle('is-range-start', date === startDate);
      button.classList.toggle('is-range-end', date === endDate);
    });
  }
  function setMessage(key) { $('#order-message').textContent = key ? t(key) : ''; }
  function showFields() {
    capture();
    if (type === 'STANDARD') kind = 'text';
    if (type === 'PREMIUM') kind = 'image';
    for (const value of ['text', 'image']) {
      const choice = dialog.querySelector(`[name=kind][value=${value}]`);
      choice.closest('label').hidden = (type === 'STANDARD' && value === 'image') || (type === 'PREMIUM' && value === 'text');
      choice.checked = kind === value;
    }
    $('#order-image-hint').textContent = t(type === 'PREMIUM' ? 'premiumImage' : 'topImage');
    $('#order-mobile-image').hidden = type !== 'PREMIUM';
    $('[name=imageFile]').required = kind === 'image' && !imageData;
    $('[name=imageMobileFile]').required = type === 'PREMIUM' && !mobileImageData;
    const text = $('#order-text-fields'), banner = $('#order-banner-fields');
    text.hidden = kind !== 'text'; banner.hidden = kind !== 'image';
    text.querySelectorAll('textarea,input').forEach(field => { field.disabled = kind !== 'text'; });
    banner.querySelectorAll('textarea,input').forEach(field => { field.disabled = kind !== 'image'; });
    const textBox = $('#order-texts'), bannerBox = $('#order-banner-copy');
    textBox.replaceChildren(); bannerBox.replaceChildren();
    for (const language of selectedLanguages) {
      const heading = node('strong', languages[language].name, 'order-language-heading');
      if (kind === 'text') {
        const label = node('label', `${t('textPrompt')} — ${languages[language].name}`);
        const field = document.createElement('textarea'); field.dataset.copy = language; field.maxLength = 1000; field.rows = 4; field.required = true; field.value = drafts[language] || '';
        label.append(field); textBox.append(label);
      } else {
        const wrapper = node('div', '', 'order-banner-language'); wrapper.append(heading);
        for (const [key, labelText, max, values] of [['title', t('bannerTitle'), 100, titles], ['description', t('bannerDescription'), 1000, descriptions]]) {
          const label = node('label', labelText); const field = key === 'title' ? document.createElement('input') : document.createElement('textarea');
          field.dataset[key] = language; field.maxLength = max; field.required = true; field.value = values[language] || '';
          if (key === 'description') field.rows = 3;
          label.append(field); wrapper.append(label);
        }
        bannerBox.append(wrapper);
      }
    }
    summary();
  }

  async function checkRange(first, last) {
    if (!first || !last || first > last || first < config.today || last > dateAt(config.today, 730)) return false;
    const days = range(first, last);
    if (!days.length || days.length > 90 || days.at(-1) !== last) { setMessage('limit'); return false; }
    const results = await Promise.all(selectedLanguages.map(language => api('availability', { language, type, startDate: first, endDate: last })));
    if (results.some(result => !result.enabled)) { setMessage('unavailable'); return false; }
    if (results.some(result => result.daysAvailable.some(day => day.remaining < 1))) { setMessage('full'); return false; }
    return true;
  }
  async function chooseDate(date) {
    if (!startDate || endDate || date < startDate) { startDate = date; endDate = ''; setMessage(''); summary(); return; }
    try {
      $('#calendar-status').textContent = t('loading');
      if (await checkRange(startDate, date)) { endDate = date; setMessage(''); }
    } catch { setMessage('error'); }
    finally { $('#calendar-status').textContent = ''; summary(); }
  }
  async function dateInputChanged(event) {
    const first = $('#order-start').value, last = $('#order-end').value;
    if (!first) { startDate = endDate = ''; summary(); return; }
    if (event.target.id === 'order-start' && first !== startDate) { startDate = first; endDate = ''; setMessage(''); summary(); return; }
    if (!last) { startDate = first; endDate = ''; summary(); return; }
    try {
      $('#calendar-status').textContent = t('loading');
      if (await checkRange(first, last)) { startDate = first; endDate = last; setMessage(''); }
    } catch { setMessage('error'); }
    finally { $('#calendar-status').textContent = ''; summary(); }
  }
  async function calendar() {
    const serial = ++version;
    const grid = $('#order-calendar'); grid.replaceChildren();
    if (!config || !type || !selectedLanguages.length) { summary(); return; }
    const [year, monthNumber] = month.split('-').map(Number);
    $('#order-month-label').textContent = new Intl.DateTimeFormat(languages[locale]?.locale || 'pl-PL', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
    const first = `${month}-01`, last = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const lastAllowed = dateAt(config.today, 730);
    $('#month-prev').disabled = month <= config.today.slice(0, 7);
    $('#month-next').disabled = month >= lastAllowed.slice(0, 7);
    for (let index = 0; index < 7; index++) grid.append(node('span', new Intl.DateTimeFormat(languages[locale]?.locale || 'pl-PL', { weekday: 'short' }).format(new Date(2026, 5, 1 + index)), 'calendar-weekday'));
    const spaces = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    for (let index = 0; index < spaces; index++) grid.append(node('span'));
    for (let day = 1; day <= Number(last.slice(-2)); day++) { const button = node('button', String(day)); button.type = 'button'; button.disabled = true; grid.append(button); }
    if (last < config.today || first > lastAllowed) return;
    $('#calendar-status').textContent = t('loading');
    try {
      const availability = await Promise.all(selectedLanguages.map(language => api('availability', { language, type, startDate: first < config.today ? config.today : first, endDate: last > lastAllowed ? lastAllowed : last })));
      if (serial !== version) return;
      $('#calendar-status').textContent = '';
      grid.querySelectorAll('button').forEach((button, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const remaining = Math.min(...availability.map(result => result.daysAvailable.find(day => day.date === date)?.remaining ?? 0));
        const enabled = availability.every(result => result.enabled);
        const free = date >= config.today && date <= lastAllowed && enabled && remaining > 0;
        button.dataset.date = date; button.disabled = !free;
        button.append(node('small', `${remaining} ${t('free')}`, 'calendar-slots'));
        button.setAttribute('aria-label', `${new Intl.DateTimeFormat(languages[locale]?.locale || 'pl-PL', { dateStyle: 'full' }).format(new Date(`${date}T12:00:00`))}, ${remaining} ${t('free')}`);
        button.onclick = () => chooseDate(date);
      });
      if (availability.some(result => !result.enabled)) setMessage('unavailable');
      summary();
    } catch { if (serial === version) { $('#calendar-status').textContent = ''; setMessage('error'); } }
  }

  function render() {
    const max = dateAt(config.today, 730);
    dialog.innerHTML = `<div class="order-heading"><div><span class="eyebrow">Polacy w Belgii</span><h2 id="order-title">${t('title')}</h2></div><button type="button" id="order-close" aria-label="${t('close')}">×</button></div>
      <p>${t('intro')}</p>${demoMode ? `<p class="order-demo" role="note">${t('demoNotice')}</p>` : ''}<p id="order-message" role="status"></p>
      <form id="order-form"><div class="order-options"><fieldset><legend>${t('languages')}</legend>${keys.map((language, index) => `<label class="order-choice"><input type="checkbox" name="languages" value="${language}" ${selectedLanguages.includes(language) ? 'checked' : ''}>${names[index]}</label>`).join('')}</fieldset>
      <fieldset><legend>${t('placement')}</legend>${['STANDARD', 'TOP', 'PREMIUM'].map(value => `<label class="order-choice"><input type="radio" name="type" value="${value}" ${type === value ? 'checked' : ''}>${t(value.toLowerCase())}</label>`).join('')}</fieldset></div>
      <fieldset><legend>${t('format')}</legend><div class="order-format-options"><label class="order-choice"><input type="radio" name="kind" value="text" ${kind === 'text' ? 'checked' : ''}>${t('text')}</label><label class="order-choice"><input type="radio" name="kind" value="image" ${kind === 'image' ? 'checked' : ''}>${t('banner')}</label></div></fieldset>
      <fieldset id="order-calendar-step"><legend>${t('dates')}</legend><p>${t('hint')}</p><div class="order-date-inputs"><label>${t('from')}<input id="order-start" type="date" min="${config.today}" max="${max}"></label><label>${t('to')}<input id="order-end" type="date" min="${config.today}" max="${max}"></label></div>
      <div class="order-month"><button type="button" id="month-prev" aria-label="${t('previous')}">‹</button><strong id="order-month-label"></strong><button type="button" id="month-next" aria-label="${t('next')}">›</button></div><p id="calendar-status" role="status"></p><div id="order-calendar"></div><p>${t('days')}: <strong id="chosen-days"></strong></p></fieldset>
      <fieldset id="order-text-fields"><legend>${t('textContent')}</legend><div id="order-texts"></div><label>${t('contact')}<input name="contact" maxlength="160" required><small>${t('contactHint')}</small></label></fieldset>
      <fieldset id="order-banner-fields" hidden><legend>${t('bannerContent')}</legend><div id="order-banner-copy"></div><label>${t('company')}<input name="company" maxlength="120" required></label><label>${t('url')}<input name="url" type="url" maxlength="2048" required></label><p id="order-image-hint"></p><label>${t('image')}<input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" required></label><p id="order-image-name"></p><div id="order-mobile-image"><label>${t('mobileImage')}<input name="imageMobileFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p id="order-mobile-image-name"></p></div><label>${t('customer')}<input name="customerName" maxlength="120" required></label></fieldset>
      <label>${t('email')}<input name="email" type="email" maxlength="254" autocomplete="email" required><small>${t('privacy')}</small></label>
      <label class="order-choice"><input name="consent" type="checkbox" required>${t('consent')}</label><div class="order-total"><span>${t('total')}</span><strong id="order-total"></strong></div><p class="order-note">${t('unpaid')}</p><button class="button" id="order-review">${t('review')}</button></form><section id="order-confirm" hidden></section>`;
    $('[name=contact]').value = contact; $('[name=email]').value = email; $('[name=company]').value = company; $('[name=url]').value = url; $('[name=customerName]').value = customerName;
    $('[name=imageFile]').required = !imageData;
    $('#order-image-name').textContent = imageName;
    $('#order-mobile-image-name').textContent = mobileImageName;
    $('#order-close').onclick = () => dialog.close();
    dialog.querySelectorAll('[name=languages],[name=type],[name=kind]').forEach(input => input.onchange = () => {
      capture(); selectedLanguages = keys.filter(key => dialog.querySelector(`[name=languages][value=${key}]`).checked);
      const previousType = type;
      type = dialog.querySelector('[name=type]:checked')?.value || '';
      kind = dialog.querySelector('[name=kind]:checked')?.value || 'text';
      if (type !== previousType) { imageData = imageName = mobileImageData = mobileImageName = ''; $('[name=imageFile]').value = ''; $('[name=imageMobileFile]').value = ''; $('#order-image-name').textContent = ''; $('#order-mobile-image-name').textContent = ''; }
      startDate = endDate = ''; requestId = crypto.randomUUID(); showFields(); calendar();
    });
    for (const [id, delta] of [['month-prev', -1], ['month-next', 1]]) $('#' + id).onclick = () => { const [year, number] = month.split('-').map(Number); month = new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7); calendar(); };
    $('#order-start').onchange = dateInputChanged; $('#order-end').onchange = dateInputChanged;
    for (const [field, mobile] of [['imageFile', false], ['imageMobileFile', true]]) {
      $(`[name=${field}]`).onchange = async event => {
        const file = event.target.files[0];
        if (mobile) { mobileImageData = ''; mobileImageName = ''; $('#order-mobile-image-name').textContent = ''; }
        else { imageData = ''; imageName = ''; $('#order-image-name').textContent = ''; }
        if (file) {
          if (file.size > 512000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage('imageError'); event.target.value = ''; }
          else {
            try {
              const bitmap = await createImageBitmap(file);
              const expected = mobile ? [660, 300] : type === 'PREMIUM' ? [1200, 200] : [1200, 720];
              const valid = bitmap.width === expected[0] && bitmap.height === expected[1]; bitmap.close();
              if (!valid) throw new Error('dimensionError');
              const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
              if (mobile) { mobileImageData = data; mobileImageName = file.name; $('#order-mobile-image-name').textContent = file.name; }
              else { imageData = data; imageName = file.name; $('#order-image-name').textContent = file.name; }
              setMessage('');
            } catch (error) { setMessage(error.message === 'dimensionError' ? 'dimensionError' : 'imageError'); event.target.value = ''; }
          }
        }
        requestId = crypto.randomUUID(); summary();
      };
    }
    $('#order-form').oninput = () => { requestId = crypto.randomUUID(); };
    $('#order-form').onsubmit = event => { event.preventDefault(); review(); };
    showFields(); calendar();
  }

  function review() {
    capture(); if (!startDate || !endDate) { setMessage('empty'); return; }
    const box = $('#order-confirm'); box.replaceChildren(node('h3', t('review')));
    for (const language of selectedLanguages) {
      box.append(node('h4', languages[language].name), node('p', kind === 'text' ? drafts[language] : `${titles[language]} — ${descriptions[language]}`));
    }
    box.append(node('p', kind === 'text' ? contact : `${company} · ${url} · ${imageName}${type === 'PREMIUM' ? ' · ' + mobileImageName : ''}`), node('p', email), node('p', `${type} · ${t(kind)} · ${startDate} – ${endDate}`), node('strong', money(total())), node('p', t('unpaid')));
    const back = node('button', t('back'), 'order-back'), send = node('button', t('send'), 'button');
    back.type = send.type = 'button'; back.onclick = () => { $('#order-form').hidden = false; box.hidden = true; };
    send.onclick = async () => {
      if (pending) return;
      pending = true; send.disabled = back.disabled = true;
      const body = { requestId, type, kind, dates: range(startDate, endDate), variants: selectedLanguages.map(language => kind === 'text' ? { language, text: drafts[language] } : { language, title: titles[language], description: descriptions[language] }), contact, email, company, url, customerName, image: imageData, imageMobile: type === 'PREMIUM' ? mobileImageData : '', consent: true, expectedTotalPrice: total() };
      try {
        const result = await api('order-batch', {}, body);
        box.replaceChildren(node('h3', t(result.demo ? 'demoSuccess' : 'success')));
        if (!result.demo) box.append(node('p', result.id), node('p', t('unpaid')));
        startDate = endDate = ''; requestId = crypto.randomUUID();
      } catch (error) {
        setMessage(({ disabled: 'unavailable', full: 'full', priceChanged: 'changed', image: 'imageError' })[error.message] || 'error');
        if (['priceChanged', 'full', 'disabled'].includes(error.message)) {
          try { config = await api('config'); } catch { /* Keep the previous quote visible. */ }
          box.hidden = true; $('#order-form').hidden = false; calendar();
        }
      } finally { pending = false; send.disabled = back.disabled = false; }
    };
    box.append(back, send); $('#order-form').hidden = true; box.hidden = false; send.focus();
  }

  async function open(trigger) {
    if (dialog.open) return;
    restoreFocus = trigger; locale = copy[document.documentElement.lang] ? document.documentElement.lang : 'pl'; selectedLanguages = [locale];
    startDate = endDate = imageData = imageName = '';
    dialog.innerHTML = `<div class="order-heading"><h2 id="order-title">${t('title')}</h2></div><p>${t('loading')}</p>`;
    dialog.showModal(); document.body.classList.add('order-open');
    try { config = await api('config'); month = month || config.today.slice(0, 7); render(); }
    catch { dialog.replaceChildren(node('p', t('error'))); const close = node('button', t('close'), 'button'); close.type = 'button'; close.onclick = () => dialog.close(); dialog.append(close); close.focus(); }
  }
  document.addEventListener('click', event => { const trigger = event.target.closest('[data-order-open],a[href="/zamow-ogloszenie/"]'); if (trigger) { event.preventDefault(); open(trigger); } });
  dialog.addEventListener('close', () => { capture(); version++; document.body.classList.remove('order-open'); restoreFocus?.focus(); });
  document.addEventListener('languagechange', () => { if (dialog.open && config) { capture(); locale = copy[document.documentElement.lang] ? document.documentElement.lang : 'pl'; render(); } });
  if (location.pathname === '/zamow-ogloszenie/') open(document.querySelector('[data-order-open]'));
})();
