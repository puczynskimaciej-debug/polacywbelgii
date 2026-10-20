(() => {
  const copy = {
    pl: { all:'Cała Belgia', flanders:'Flandria', wallonia:'Walonia', brussels:'Region Stołeczny Brukseli', brusselsShort:'Bruksela', heading:'Odkryj Belgię według regionu', hint:'Wybierz region na mapie', choose:'Wybierz region Belgii', mapAlt:'Mapa administracyjna Belgii: Flandria, Walonia i Region Stołeczny Brukseli', modalEyebrow:'Odkryj region', modalQuestion:'Co chcesz zobaczyć w tym regionie?', events:'Wydarzenia', eventsDescription:'Sprawdź wydarzenia w regionie', listings:'Ogłoszenia', listingsDescription:'Zobacz lokalne oferty i usługi', close:'Zamknij', emptyEvents:'Brak wydarzeń dla wybranego regionu. Zajrzyj ponownie wkrótce.', emptyAds:'Brak ogłoszeń dla wybranego regionu.', back:'Wybierz inny region' },
    fr: { all:'Toute la Belgique', flanders:'Flandre', wallonia:'Wallonie', brussels:'Région de Bruxelles-Capitale', brusselsShort:'Bruxelles', heading:'Découvrez la Belgique par région', hint:'Choisissez une région sur la carte', choose:'Choisir une région de Belgique', mapAlt:'Carte administrative de la Belgique : Flandre, Wallonie et Bruxelles-Capitale', modalEyebrow:'Découvrez la région', modalQuestion:'Que souhaitez-vous voir dans cette région ?', events:'Événements', eventsDescription:'Découvrez les événements de la région', listings:'Annonces', listingsDescription:'Voir les offres et services locaux', close:'Fermer', emptyEvents:'Aucun événement pour cette région. Revenez bientôt.', emptyAds:'Aucune annonce pour cette région.', back:'Choisir une autre région' },
    nl: { all:'Heel België', flanders:'Vlaanderen', wallonia:'Wallonië', brussels:'Brussels Hoofdstedelijk Gewest', brusselsShort:'Brussel', heading:'Ontdek België per regio', hint:'Kies een regio op de kaart', choose:'Kies een regio in België', mapAlt:'Administratieve kaart van België: Vlaanderen, Wallonië en Brussel', modalEyebrow:'Ontdek de regio', modalQuestion:'Wat wilt u in deze regio bekijken?', events:'Evenementen', eventsDescription:'Bekijk evenementen in de regio', listings:'Advertenties', listingsDescription:'Bekijk lokale aanbiedingen en diensten', close:'Sluiten', emptyEvents:'Geen evenementen voor deze regio. Kom binnenkort terug.', emptyAds:'Geen advertenties voor deze regio.', back:'Kies een andere regio' }
  };
  const valid = new Set(['all','flanders','wallonia','brussels']);
  const page = document.body.dataset.page;
  const requested = new URLSearchParams(location.search).get('region');
  const selected = ['events','regionalAds'].includes(page) && valid.has(requested) ? requested : 'all';
  window.portalRegion = () => selected;
  const dialog = document.querySelector('#region-dialog');
  let dialogRegion = 'all';
  let returnFocus;
  const language = () => copy[document.documentElement.lang] || copy.pl;
  function translate() {
    const words = language();
    document.querySelectorAll('[data-region-text]').forEach(node => { node.textContent = words[node.dataset.regionText]; });
    document.querySelectorAll('[data-i18n-aria="region.choose"]').forEach(node => node.setAttribute('aria-label',words.choose));
    const mapTitle = document.querySelector('#belgium-map-title'); if (mapTitle) mapTitle.textContent = words.mapAlt;
    document.querySelectorAll('[data-region-choice]').forEach(node => node.setAttribute('aria-label',words[node.dataset.regionChoice]));
    const close = document.querySelector('[data-region-close]'); if (close) close.setAttribute('aria-label',words.close);
    document.querySelectorAll('[data-region-view-title]').forEach(node => { node.textContent = words[node.dataset.regionViewTitle] + ' · ' + words[selected]; });
    document.querySelectorAll('[data-region-empty]').forEach(node => { node.textContent = words[node.dataset.regionEmpty === 'events' ? 'emptyEvents' : 'emptyAds']; });
    document.querySelectorAll('[data-region-back]').forEach(node => { node.textContent = words.back; });
    if (dialog?.open) updateDialog();
  }
  function updateDialog() {
    const words = language();
    dialog.querySelector('[data-region-title]').textContent = words[dialogRegion];
    dialog.querySelector('[data-region-link="events"]').href = '/wydarzenia/?region=' + dialogRegion;
    dialog.querySelector('[data-region-link="listings"]').href = '/ogloszenia/?region=' + dialogRegion;
  }
  function open(region, trigger) {
    if (!dialog || !valid.has(region)) return;
    dialogRegion = region; returnFocus = trigger;
    document.querySelectorAll('[data-region-choice]').forEach(node => node.classList.toggle('is-active', node.dataset.regionChoice === region));
    updateDialog(); dialog.showModal();
    dialog.querySelector('[data-region-close]').focus();
  }
  if (dialog) {
    document.addEventListener('click', event => { const button = event.target.closest('[data-region-choice]'); if (button) open(button.dataset.regionChoice, button); });
    document.addEventListener('keydown', event => { const region = event.target.closest('[data-region-map] [data-region-choice]'); if (region && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(region.dataset.regionChoice, region); } });
    dialog.querySelector('[data-region-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { document.querySelectorAll('[data-region-choice]').forEach(node => node.classList.remove('is-active')); returnFocus?.focus(); });
  }
  if (page === 'events') {
    const rows = [...document.querySelectorAll('[data-event-region]')];
    const list = document.querySelector('[data-event-list]');
    const ordered = selected === 'all' ? rows : [...rows.filter(row => row.dataset.eventRegion === selected), ...rows.filter(row => row.dataset.eventRegion === 'all')];
    rows.forEach(row => { row.hidden = !ordered.includes(row); });
    ordered.forEach(row => list.append(row));
    const empty = document.querySelector('[data-region-empty="events"]'); if (empty) empty.hidden = ordered.length > 0;
  }
  document.addEventListener('languagechange', translate);
  translate();
})();
