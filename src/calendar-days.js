/* Calendar dates are interpreted in Europe/Brussels. Institutional days are not general public holidays. */
(() => {
  const names = {
    newYear: ['Nowy Rok', 'Nieuwjaar', 'Nouvel An', 'New Year’s Day'],
    easterMon: ['Poniedziałek Wielkanocny', 'Paasmaandag', 'Lundi de Pâques', 'Easter Monday'],
    labour: ['Święto Pracy', 'Dag van de Arbeid', 'Fête du Travail', 'Labour Day'],
    ascension: ['Wniebowstąpienie', 'O.L.H. Hemelvaart', 'Ascension', 'Ascension Day'],
    whitMon: ['Poniedziałek Zielonoświątkowy', 'Pinkstermaandag', 'Lundi de Pentecôte', 'Whit Monday'],
    national: ['Święto Narodowe Belgii', 'Nationale feestdag', 'Fête nationale', 'Belgian National Day'],
    assumption: ['Wniebowzięcie NMP', 'O.L.V. Hemelvaart', 'Assomption', 'Assumption Day'],
    allSaints: ['Wszystkich Świętych', 'Allerheiligen', 'Toussaint', 'All Saints’ Day'],
    armistice: ['Dzień Zawieszenia Broni', 'Wapenstilstand', 'Armistice', 'Armistice Day'],
    christmas: ['Boże Narodzenie', 'Kerstmis', 'Noël', 'Christmas Day'],
    flanders: ['Święto Wspólnoty Flamandzkiej', 'Feestdag van de Vlaamse Gemeenschap', 'Fête de la Communauté flamande', 'Flemish Community Day'],
    wallonia: ['Święto Wspólnoty Francuskiej', 'Feestdag van de Franse Gemeenschap', 'Fête de la Communauté française', 'French Community Day'],
    brussels: ['Święto Regionu Stołecznego Brukseli', 'Feest van het Brussels Hoofdstedelijk Gewest', 'Fête de la Région de Bruxelles-Capitale', 'Brussels Capital Region Day']
  };
  const source = {
    national: 'https://employment.belgium.be/en/themes/international/posting/working-conditions-be-respected-case-posting-belgium/public-holidays?id=38256',
    flanders: 'https://www.vlaanderen.be/uw-overheid/over-vlaanderen/11-juli-feestdag-van-de-vlaamse-gemeenschap',
    wallonia: 'https://wallex.wallonie.be/eli/arrete/2003/12/18/2003027783/2026/08/20',
    brussels: 'https://www.talent.brussels/fr/fonctionnaires/jours-feries-la-region-bruxelloise'
  };
  const langIndex = { pl: 0, nl: 1, fr: 2, en: 3 };
  const iso = date => date.toISOString().slice(0, 10);
  const at = (year, month, day) => iso(new Date(Date.UTC(year, month - 1, day)));
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    return new Date(Date.UTC(year, month - 1, (h + l - 7 * m + 114) % 31 + 1));
  }
  const offset = (date, days) => iso(new Date(date.getTime() + days * 86400000));
  function holidays(date, region = 'all') {
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) return [];
    const year = Number(date.slice(0, 4)), easterDay = easter(year);
    const federal = [
      [at(year, 1, 1), 'newYear'], [offset(easterDay, 1), 'easterMon'],
      [at(year, 5, 1), 'labour'], [offset(easterDay, 39), 'ascension'],
      [offset(easterDay, 50), 'whitMon'], [at(year, 7, 21), 'national'],
      [at(year, 8, 15), 'assumption'], [at(year, 11, 1), 'allSaints'],
      [at(year, 11, 11), 'armistice'], [at(year, 12, 25), 'christmas']
    ];
    const regional = [
      [at(year, 5, 8), 'brussels'], [at(year, 7, 11), 'flanders'], [at(year, 9, 27), 'wallonia']
    ];
    return [...federal.map(([day, key]) => ({ day, key, region: 'all', scope: 'federal', source: source.national })),
      ...regional.map(([day, key]) => ({ day, key, region: key, scope: 'institutional', source: source[key] }))]
      .filter(item => item.day === date && (item.region === 'all' || region === 'all' || region === item.region));
  }
  const label = (holiday, language = 'pl') => names[holiday.key]?.[langIndex[language] ?? 0] || holiday.key;
  const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const sunday = date => new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
  window.PbeCalendar = { holidays, label, today, sunday };
})();
