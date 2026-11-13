import { readFileSync, writeFileSync } from 'node:fs';

// Local-only examples. The source file lives under .local and Eleventy excludes it
// from production builds.
const file = new URL('../.local/demo-ads.json', import.meta.url);
const demo = JSON.parse(readFileSync(file, 'utf8'));
for (const language of ['pl', 'en', 'nl', 'fr']) {
  const premium = demo.ads.find(ad => ad.language === language && ad.type === 'PREMIUM');
  if (premium && !demo.ads.some(ad => ad.id === `${language}-premium-2`)) demo.ads.push({ ...premium, id: `${language}-premium-2`, title: `${premium.title} · DEMO 2` });
  const top = demo.ads.filter(ad => ad.language === language && ad.type === 'TOP');
  for (let index = top.length; index < 5; index++) {
    const source = top[index % top.length];
    if (!source) break;
    demo.ads.push({ ...source, id: `${language}-top-${index}`, title: `${source.title} · DEMO ${index + 1}` });
  }
}
// Keep the carousel's existing number of local examples, while making the
// Polish preview representative of real submissions. No demo enters D1.
const premiumExamples = [
  { title:'Dam pracę w Belgii', description:'Szukamy fachowców budowlanych do pracy w Brukseli i okolicach. Oferujemy regularne zlecenia, jasne warunki współpracy i możliwość dłuższego zatrudnienia.', company:'Jan Kowalski' },
  { title:'Transport na terenie Belgii', description:'Przewozimy meble, paczki i drobny sprzęt na terenie Belgii oraz do Polski. Pomagamy przy załadunku i ustalamy termin dopasowany do potrzeb klienta. Zapytaj o wycenę.', company:'Marek Nowak' }
];
const topExamples = [
  { title:'Sprzedam rower elektryczny', description:'Sprzedam zadbany rower elektryczny, w pełni sprawny, z ładowarką i dokumentami. Możliwość obejrzenia po umówieniu terminu. Odbiór w Brukseli.', company:'Anna Nowak' },
  { title:'Usługi remontowe w Brukseli', description:'Wykonujemy malowanie, gładzie, montaż paneli i drobne remonty mieszkań. Działamy w Brukseli i okolicach. Wycenę ustalamy po obejrzeniu prac.', company:'Jan Kowalski' },
  { title:'Sprzątanie mieszkań w Antwerpii', description:'Oferuję sprzątanie mieszkań i niewielkich biur w Antwerpii. Przyjmuję zlecenia jednorazowe i regularne. Termin ustalam indywidualnie.', company:'Ewa Zielińska' },
  { title:'Sprzedam komplet mebli do salonu', description:'Sprzedam stół, cztery krzesła i komodę w dobrym stanie. Meble można obejrzeć po wcześniejszym umówieniu. Odbiór w Leuven.', company:'Piotr Wiśniewski' },
  { title:'Lekcje języka niderlandzkiego', description:'Prowadzę lekcje języka niderlandzkiego online i w Gandawie. Materiały dobieram do poziomu oraz celu nauki. Termin do uzgodnienia.', company:'Katarzyna Wójcik' }
];
const standardExamples = [
  { title:'Domowe obiady na zamówienie', description:'Przygotowuję domowe obiady dla osób pracujących w okolicach Antwerpii. Menu obejmuje zupy, dania mięsne i wegetariańskie oraz porcje rodzinne. Skład i termin odbioru ustalam przed przyjęciem zamówienia. Potrawy powstają na bieżąco, dlatego proszę o wiadomość z wyprzedzeniem. Możliwy odbiór po pracy lub w weekend, zależnie od liczby zamówień.', company:'Anna Nowak' },
  { title:'Przewóz rzeczy między miastami Belgii', description:'Pomagam w przewozie kartonów, rowerów i niewielkich mebli między Brukselą, Antwerpią i Gandawą. Przed ustaleniem terminu proszę o wymiary oraz zdjęcie większych przedmiotów. Mogę pomóc przy załadunku, jeśli miejsce postoju jest dostępne. Cena zależy od trasy i objętości ładunku; przed wyjazdem potwierdzam ją indywidualnie. Przyjmuję także zlecenia weekendowe.', company:'Marek Nowak' },
  { title:'Pomoc w księgowości małej firmy', description:'Oferuję pomoc w uporządkowaniu dokumentów małej działalności w Belgii oraz przygotowaniu zestawień dla księgowego. Wyjaśniam, jakie faktury i potwierdzenia warto zachować, i pomagam ustalić prosty sposób archiwizacji. Spotkania odbywają się online lub w Brukseli po wcześniejszym umówieniu. Zakres współpracy ustalam po rozmowie o potrzebach firmy.', company:'Ewa Zielińska' },
  { title:'Drobne remonty mieszkań w Brukseli', description:'Wykonuję malowanie ścian, drobne naprawy, montaż półek i paneli oraz odświeżanie mieszkań przed wynajmem. Pracuję w Brukseli i pobliskich gminach. Przed rozpoczęciem oglądam zakres prac albo proszę o zdjęcia, aby przygotować realny termin i wycenę. Materiały możemy kupić wspólnie lub wykorzystać te dostarczone przez właściciela. Podejmuję także niewielkie zlecenia jednodniowe.', company:'Jan Kowalski' },
  { title:'Polskie produkty na zamówienie', description:'Przyjmuję zamówienia na wybrane polskie produkty spożywcze z odbiorem w okolicach Leuven. Listę dostępnych artykułów i terminy odbioru przekazuję przed potwierdzeniem zamówienia. Można zamówić mniejsze ilości dla jednej osoby albo wspólną paczkę dla rodziny. Proszę o podanie nazw produktów i liczby sztuk, aby sprawdzić dostępność oraz przygotować dokładną cenę.', company:'Katarzyna Wójcik' },
  { title:'Zajęcia języka francuskiego online', description:'Prowadzę indywidualne lekcje francuskiego dla osób, które mieszkają lub planują pracę w Belgii. Ćwiczymy codzienne rozmowy, podstawowe formularze oraz słownictwo związane z urzędem i miejscem pracy. Tempo zajęć dopasowuję do poziomu kursanta. Pierwsze spotkanie służy ustaleniu celów i planu nauki. Terminy popołudniowe oraz weekendowe są możliwe po uzgodnieniu.', company:'Anna Nowak' },
  { title:'Serwis i regulacja rowerów', description:'Wykonuję podstawową regulację hamulców i przerzutek, wymianę dętek oraz przegląd roweru przed sezonem. Przyjmuję rowery w Brukseli po umówieniu godziny. Przed naprawą wyjaśniam, które części wymagają wymiany i przedstawiam koszt materiałów. Jeśli potrzebna jest bardziej specjalistyczna usługa, informuję o tym przed rozpoczęciem prac. Odbiór zwykle jest możliwy po uzgodnieniu terminu.', company:'Piotr Wiśniewski' },
  { title:'Pomoc przy przeprowadzce w Belgii', description:'Pomagam przy pakowaniu, wynoszeniu i ustawianiu rzeczy podczas przeprowadzek na terenie Belgii. Zakres pracy ustalamy przed terminem na podstawie listy większych przedmiotów, liczby pięter i dostępu do windy. Mogę pracować sam lub w dwuosobowym zespole. Nie przewożę przedmiotów wymagających specjalnych zezwoleń. Proszę o kontakt kilka dni wcześniej, aby potwierdzić dostępność.', company:'Marek Nowak' },
  { title:'Zdjęcia rodzinne w plenerze', description:'Wykonuję sesje rodzinne i portretowe w plenerze na terenie Brukseli oraz okolic. Przed sesją wspólnie wybieramy miejsce, porę dnia i styl zdjęć. Po spotkaniu wybieram fotografie do obróbki i przekazuję je w formie cyfrowej w uzgodnionym terminie. Możliwe są krótkie sesje dla par oraz dłuższe spotkania rodzinne. Informację o cenie podaję po ustaleniu zakresu.', company:'Ewa Zielińska' },
  { title:'Montaż mebli i drobne naprawy', description:'Składam meble kupione w sklepach, montuję półki i wykonuję drobne naprawy domowe w okolicach Antwerpii. Przed wizytą proszę o nazwę modelu lub zdjęcie elementów oraz informację o rodzaju ściany. Dzięki temu mogę przygotować potrzebne narzędzia i ustalić czas pracy. Materiały montażowe zapewnia klient albo kupujemy je po wcześniejszym uzgodnieniu. Termin ustalam indywidualnie.', company:'Jan Kowalski' }
];
for (const ad of demo.ads) {
  if (ad.type !== 'STANDARD') { ad.image = ''; ad.imageMobile = ''; ad.url = ''; ad.contact = 'kontakt@przyklad.invalid (DEMO)'; }
  if (ad.language !== 'pl') continue;
  const index = Number(ad.id.match(/-(\d+)$/)?.[1]);
  const example = ad.type === 'PREMIUM' ? premiumExamples[Number.isInteger(index) ? 1 : 0] : ad.type === 'TOP' ? topExamples[index] : standardExamples[index];
  if (!example) continue;
  Object.assign(ad,example);
  if (ad.type === 'STANDARD') ad.contact = '';
}
writeFileSync(file, `${JSON.stringify(demo, null, 2)}\n`);
