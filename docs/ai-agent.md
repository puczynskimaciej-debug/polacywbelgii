# AI Redaktor: lokalne MVP

> Ten dokument opisuje wcześniejszy etap prototypu. Aktualna instrukcja wspólnej D1, panelu CMS i publikatora znajduje się w [editorial-workflow.md](editorial-workflow.md). W szczególności informacje poniżej o osobnym SQLite, publicznej kopii szkicu i braku automatycznego publikatora są nieaktualne.

## Architektura i granica publikacji

Publiczna strona jest budowana przez Eleventy z plików `src/content/articles/*.md`. Wpisanie pliku do tego katalogu przez CMS `/admin` zapisuje go w repozytorium GitHub i może uruchomić publikację. Obecny CMS nie ma statusu szkicu. Dlatego agent trzyma materiały w `.local/agent/state.json` i `.local/drafts/`, poza katalogiem strony. Nie korzysta z API CMS do zapisu szkiców. `functions/api/ai-editor.js` jest przygotowanym endpointem kolejki na D1; nie publikuje treści.

`agent/cli.mjs` czyta rejestr `agent/sources.json`, pobiera aktywne RSS/Atom lub publiczne strony HTML, normalizuje adresy, ocenia tematy, wykrywa duplikaty, sprawdza minimalne dowody i zapisuje stan oraz raport uruchomienia. Dla HTML zbiera tylko linki z tego samego hosta; nie pobiera podstron i nie uznaje samego linku za potwierdzenie treści. Dlatego pozycje odkryte w sieci nie zostają automatycznie artykułami. Wydarzenia wymagają daty początku i końca, strefy, miejsca, miasta, organizatora i linku. Wiadomości wymagają potwierdzonych twierdzeń. Kategorie urzędowe, podatkowe, prawne i zdrowotne wymagają oficjalnego źródła.

Fixture'y w `agent/fixtures.json` są fikcyjne. Deterministyczny generator tworzy z nich teksty oznaczone jako testowe. `agent/gemini.mjs` i `agent/generate.mjs` pozwalają wygenerować szkic z oficjalnego materiału ze zweryfikowanymi twierdzeniami, gdy skonfigurowano klucz Gemini i potwierdzono darmowy poziom API. Wynik wymaga ręcznej weryfikacji. Warstwa ogólnego API AI w `agent/provider.mjs` pozostaje odrębna i nie jest uruchamiana przez pipeline.

## Uruchomienie

```text
npm run agent:fixture
npm run agent:fixture
npm run agent:dry-run
npm run agent:import-first
npm run agent:db
node agent/local-db.mjs --fixture
node scripts/preview-article-draft.js ilu-polakow-mieszka-w-belgii
npm run test:agent
```

Pierwsze uruchomienie fixture'ów tworzy trzy demonstracyjne materiały, drugie nie tworzy kopii. `dry-run` pokazuje wynik bez zapisu. Raporty są w lokalnym JSON, a synchronizacja do SQLite używa schematu zgodnego z D1. Wygenerowany podgląd otwórz z `.local/preview/`. Wszystkie pliki `.local/` są ignorowane przez Git. `npm run agent:run` uruchamia tryb sieciowy, ale wszystkie źródła są domyślnie nieaktywne; nie wykonuje płatnych wywołań.

## Źródła i konfiguracja

Każdy wpis `agent/sources.json` ma `id`, `url`, `type` (`rss`, `atom`, `html`), `language`, `region`, `intervalHours`, `priority`, `active`, `official`. URL i typ trzeba sprawdzić przed aktywacją. Obecne oficjalne strony są wpisane jako nieaktywne, bo nie ustalono dla nich stabilnych feedów ani zasad automatycznego odpytywania. Skrypt nie obchodzi logowania, CAPTCHA ani przekierowań. Nie ma harmonogramu. Pola częstotliwości i priorytetu są przygotowane, ale bieżący CLI nie egzekwuje częstotliwości między uruchomieniami.

## Baza i panel

`agent/migrations/001_agent.sql` tworzy tabele źródeł, materiałów, kandydatów, historii statusów, uruchomień, kosztów i konfiguracji. `agent/local-db.mjs` stosuje migrację do lokalnego SQLite i importuje stan bez duplikatów. Sekcja **AI Redaktor** w istniejącym `/admin` wyświetla kolejkę, źródła, ostatnie uruchomienie i koszt; uprawniony administrator może zmienić status lub aktywność źródła przez uwierzytelniony endpoint. Akceptacja nie publikuje. Panel wymaga osobnego zastosowania migracji do lokalnego D1 i zaimportowania danych; lokalny plik SQLite CLI nie jest automatycznie tą samą bazą co D1 procesu Pages.

## Pierwszy artykuł

`.local/drafts/ilu-polakow-mieszka-w-belgii.md` przeszedł walidację CMS. Bezpośrednio potwierdzono liczby 17 475 i 23 268 dla Regionu Stołecznego Brukseli w opracowaniu IBSA. Wartość 43,9 tys. dla całej Belgii usunięto, ponieważ nie udało się jej odczytać bezpośrednio z tabeli GUS. W lokalnej kolejce artykuł ma status `draft` i `needs_review`. Przed publikacją trzeba sprawdzić tabelę GUS, aktualność danych i wersje językowe.

## Dalsze prace przed wdrożeniem

- Podłączyć proces CLI do D1 w Workers, zapewnić transakcyjny zapis oraz test integracyjny z lokalnym Pages/D1.
- Dodać adaptery źródeł, które pobierają pełne komunikaty i wyodrębniają twierdzenia z cytowalnym dowodem. Zaimplementować `robots.txt` i polityki częstotliwości dla każdego źródła.
- Podłączyć model do pisania tylko po weryfikacji faktów, z ponowną walidacją liczb i źródeł, zapisaniem tokenów/kosztów i limitami dziennymi oraz miesięcznymi.
- Rozbudować panel o edycję kandydatów, ustawienia, historię zmian i bezpieczny import do istniejącego edytora. Obecny panel pozwala na podgląd i zmianę statusu, ale nie na edycję tekstu.
- Po testach lokalnych można dodać Cloudflare Cron jako `triggers.crons` we Wranglerze. Nie dodano go teraz i niczego nie wdrożono. Automatyczna publikacja nie jest zaimplementowana.

## Testy i bezpieczeństwo

Testy w `tests/agent.test.mjs` sprawdzają parsery, URL, duplikaty, daty wydarzeń, `dry-run`, migrację i limity API. `functions/api/ai-editor.js` wymaga sesji CMS; zapis statusu i źródła wymaga roli administratora. Treść z internetu jest przechowywana jako dane, nigdy wykonywana jako instrukcje. Nie zapisujemy sekretów w frontendzie ani logach. Nie wykonano płatnych wywołań ani zmian na produkcji.

Ostatnia lokalna weryfikacja: `node --test tests/agent.test.mjs tests/cloudflare.test.mjs` — 10 testów zaliczonych, `npm run lint` i `npm run build` — zaliczone. Pełne `npm test` nie przeszło: istniejący zestaw reklam/CMS nie uruchomił wbudowanego PostgreSQL w tym środowisku Windows (`initdb`: ograniczony token i odmowa utworzenia katalogu w `test-results`). Nie jest to wynik testów nowego agenta.
