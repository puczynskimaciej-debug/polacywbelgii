# CMS: e-mail i hasło

Przełącznik „Edytowany język” wybiera treści PL/NL/FR. Polska wersja pozostaje w głównych polach `home.json` i `site.json`, a niezależne wersje niderlandzka i francuska w `locales.nl` oraz `locales.fr`. Każda wersja ma własny hero, listy informacji i ogłoszeń, kontakt i SEO. Edytor artykułu otwiera zakładkę wybranego języka. Media i konta użytkowników pozostają wspólne. Publiczna strona korzysta z tych danych zamiast stałych tłumaczeń treści redakcyjnych.

## Netlify Database

Projekt zawiera `@netlify/database` i migrację `netlify/database/migrations/20260928130000_portal/migration.sql`. Netlify tworzy bazę oraz stosuje migracje podczas wdrożenia. Podgląd `cms-check` używa osobnej gałęzi bazy. Funkcje korzystają z aktualnego API Request/Response i SDK pobierającego połączenie właściwe dla danego wdrożenia; starszy tryb Lambda nie zapewnia automatycznej konfiguracji bazy. Jawne `DATABASE_URL` nadal służy do zewnętrznego PostgreSQL i testów lokalnych.

Konfiguracja pakowania w `netlify.toml` dołącza zależności bazy także przy publikacji z Windows. Kod obsługi endpointów znajduje się w `server/handlers`, a wejścia funkcji w `netlify/functions/*.mjs`.

Użytkownik otwiera `/admin/` i wpisuje e-mail oraz hasło. Nie potrzebuje konta GitHub. Administrator dodaje konta w sekcji **Użytkownicy i role**, nadaje role **Edytor / Administrator** i może zablokować dostęp.

## Co pozostaje w tle

Artykuły, strona główna, SEO i media nadal są przechowywane w dotychczasowym repozytorium. Backend zapisuje zmiany, a Netlify przebudowuje publiczną stronę. Przeglądarka komunikuje się wyłącznie z API portalu; token techniczny GitHub nie jest jej udostępniany. Reklamy i konta użytkowników korzystają z prywatnego PostgreSQL. Zmiana dotyczy logowania i dostępu do CMS, nie przenosi archiwum treści do nowego CMS.

## Pierwsze uruchomienie

1. W Netlify skonfiguruj:
   - `DATABASE_URL` — prywatny adres PostgreSQL, ten sam co dla reklam, z ustawieniami TLS wskazanymi przez dostawcę.
   - `CMS_ORIGIN` — dokładny publiczny adres, np. `https://polacywbelgii.eu`, **bez końcowego ukośnika**. Panel i jego API muszą działać pod tą samą domeną. Przekieruj pozostałe warianty domeny na ten adres.
   - `CMS_GITHUB_TOKEN` — techniczny fine-grained token z dostępem wyłącznie do repozytorium portalu i uprawnieniem **Contents: Read and write**. Nie wymaga uprawnień do zarządzania użytkownikami GitHub. Ustaw termin ważności i odnawiaj token przed wygaśnięciem.
   - Opcjonalnie `CMS_GITHUB_REPOSITORY` (`owner/repo`) oraz `CMS_GITHUB_BRANCH`; domyślnie aktualne repozytorium i `main`.
2. W lokalnym terminalu z ustawionym `DATABASE_URL` uruchom:

   ```text
   npm run cms:migrate
   npm run cms:admin
   ```

   Pierwsze polecenie tworzy tabele kont, sesji, limitów logowania i historii operacji. Drugie pyta o e-mail, nazwę i hasło pierwszego administratora. Hasło jest niewidoczne podczas wpisywania; nie trafia do argumentów procesu, plików ani logów. Skrypt działa tylko przed utworzeniem pierwszego konta.
3. Jeśli baza nie ma jeszcze tabel reklam, wykonaj również `npm run ads:migrate`.
4. Opublikuj kod standardową ścieżką Netlify. Nie ma automatycznego wdrożenia w ramach tej zmiany.
5. Otwórz `/admin/` i zaloguj się utworzonym kontem. Sprawdź odczyt artykułów oraz zapis testowej zmiany.

Zmienne są sekretami serwera. Nie zapisuj ich w `admin-app/config.js`, plikach publikowanych ani repozytorium. Stare `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` i `ADS_GITHUB_REPOSITORY` nie są już używane; po sprawdzeniu migracji możesz je usunąć z Netlify oraz wyłączyć poprzednią aplikację OAuth. Konta collaboratorów GitHub nie są automatycznie kontami CMS — dodaj potrzebne osoby w panelu.

## Dodawanie użytkownika

1. **Użytkownicy i role → Dodaj osobę**.
2. Wpisz imię i nazwisko, e-mail, rolę i hasło tymczasowe (15–128 znaków).
3. Przekaż użytkownikowi adres `/admin/`, e-mail i hasło bezpiecznym kanałem. Portal nie wysyła automatycznych wiadomości e-mail.
4. Po pierwszym logowaniu użytkownik musi ustawić własne hasło, zanim uzyska dostęp do treści lub reklam.

Edytor może zarządzać artykułami, stroną główną, SEO, mediami i reklamami. Administrator dodatkowo zarządza kontami i widzi historię publikacji. Zmiana roli, blokada konta lub hasła unieważnia istniejące sesje tego konta. Panel nie pozwala administratorowi odebrać samemu sobie dostępu ani usunąć ostatniego aktywnego administratora.

## Zmiana lub odzyskanie hasła

- Każda osoba może kliknąć **Zmień hasło** po zalogowaniu i podać dotychczasowe hasło. Pozostałe sesje zostaną unieważnione.
- Administrator może otworzyć konto innej osoby, ustawić hasło tymczasowe i przekazać je użytkownikowi. Następne logowanie wymaga zmiany.
- Jeśli pierwszy administrator utracił hasło, operator z dostępem do `DATABASE_URL` uruchamia `npm run cms:reset-password`. Skrypt pyta o e-mail i nowe hasło, unieważnia sesje i wymusza zmianę hasła przy następnym logowaniu. Nie zmienia roli ani nie odblokowuje konta.

## Ochrona dostępu

- Hasła są haszowane przez scrypt (`N=131072`, `r=8`, `p=1`) z losową solą dla każdego hasła; nigdy nie są przechowywane jawnie.
- Sesja ma losowy token 256-bitowy. W bazie zapisany jest wyłącznie jego SHA-256. Cookie produkcyjne `__Host-pbe_session` używa `HttpOnly`, `Secure`, `SameSite=Strict` i `Path=/`; sesja wygasa po 8 godzinach.
- Zapisy wymagają dokładnego `Origin` z konfiguracji. API nie udostępnia CORS i przyjmuje JSON. Role, blokady i wymagana zmiana hasła są sprawdzane po stronie serwera przy każdym żądaniu.
- Próby logowania są limitowane w bazie: do 10 na konto i 30 na adres IP w 15 minut, również pomiędzy instancjami funkcji. Komunikat o błędnym haśle nie ujawnia istnienia konta.
- Backend publikacji pozwala modyfikować wyłącznie artykuły, wskazane dane strony i obrazy. Nie udostępnia dowolnego proxy GitHub ani zapisu kodu, workflow, konfiguracji czy szablonów. Sprawdza formaty i wielkość plików. Limit mediów wynosi 4 MB, aby plik po zakodowaniu zmieścił się w żądaniu Netlify.
- Konto CMS jest oznaczane w komunikacie commita; jego adres e-mail nie jest publikowany w repozytorium. Dziennik zmian kont przechowuje identyfikatory i typy operacji, bez haseł i tokenów.

Podstawa konfiguracji: [OWASP — przechowywanie haseł](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP — ochrona CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [GitHub — uprawnienia Contents API](https://docs.github.com/en/rest/repos/contents).

## Testy i uruchamianie lokalne

Przed publikacją uruchom `npm run deploy:check` z docelowymi zmiennymi środowiskowymi. Sprawdzi konfigurację, połączenie z bazą, komplet tabel oraz obecność aktywnego administratora. Nie drukuje wartości sekretów. Endpoint `/.netlify/functions/health` zwraca jedynie `{ "ready": true }` (200) albo `{ "ready": false }` (503). Gotowość konfiguracji nie zastępuje sprawdzenia zapisu artykułu i zamówienia na wersji przedprodukcyjnej.

Połączenie obsługuje również `NETLIFY_DB_URL`, jeżeli projekt korzysta z wbudowanej bazy Netlify. Jawne `DATABASE_URL` ma pierwszeństwo. Podgląd wdrożenia powinien korzystać z oddzielnej bazy lub gałęzi bazy, aby testowe zamówienia nie trafiały na produkcję.

`npm test` wykonuje build, uruchamia izolowany PostgreSQL i testy API/przeglądarki. Sprawdza rzeczywiste logowanie, cookies, wygaśnięcie i odebranie sesji, zmianę hasła, role, ograniczenie prób, walidację zapisywanych plików oraz scenariusz utworzenia konta i edycji artykułu. GitHub jest zastępowany tylko w testach; testy nie zapisują niczego do rzeczywistego repozytorium. Potrzebny jest lokalny Edge lub `BROWSER_PATH` wskazujący Chrome/Chromium.

`npm run lint` sprawdza JavaScript. Dotychczasowy `npm run test:responsive` działa ze statycznym serwerem `npm run dev -- --port=8088` i testowymi odpowiedziami API.

Do pełnej pracy lokalnej użyj `netlify dev`, testowej bazy i `CMS_ORIGIN` zgodnego z lokalnym adresem. HTTP jest dopuszczone tylko dla `localhost` oraz `127.0.0.1`; lokalne cookie ma nazwę `pbe_session_dev`. Statyczny `npm run dev` nie uruchamia serwera logowania.
