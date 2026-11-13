# Stabilizacja lokalna CMS i publikacji

Stan: 11 listopada 2026. Żadna zmiana nie została wdrożona, wypchnięta do GitHuba ani zastosowana w zdalnej D1.

## Architektura i wybór publikacji

Eleventy buduje stałą powłokę strony, style i skrypty. Pages Functions odczytują opublikowane artykuły, wydarzenia, obrazy i sitemap bezpośrednio z D1. Umożliwia to publikację i wycofanie bez przebudowy projektu oraz bez zależności od GitHub API w CMS. Statyczny build pozostaje potrzebny po zmianie kodu lub wyglądu. Alternatywny model, w którym każda publikacja uruchamia build, wymagałby kolejki deployów, poświadczeń do wdrożenia, obsługi kolizji i rollbacku dwóch stanów. Dynamiczny model ma prostszy zapis i wycofanie, ale każda publiczna wizyta zużywa odczyty D1.

`CMS_CONTENT_BACKEND=d1` jest ustawione wyłącznie w ignorowanym lokalnym `.dev.vars`. Bez tej zmiennej dotychczasowy adapter GitHub działa jak wcześniej. Przed włączeniem tej flagi w środowisku zdalnym trzeba ukończyć migrację zdalnej bazy, import, porównanie zawartości i testy na osobnej bazie preview. Nie włączać flagi na produkcji przed tymi krokami.

## Lokalna migracja

1. `npm run local:d1:setup` — nakłada schematy, w tym `agent/migrations/003_content.sql`, wyłącznie na lokalną D1.
2. `npm run content:import-local` — wykonuje `VACUUM INTO` do `.local/content-before-import-*.sqlite`, importuje istniejące pliki z `src/_data`, `src/content/articles` (bez plików `ai-*`) i `src/Images/uploads`, a następnie sprawdza bajty. Istniejące ścieżki omija, więc ponowne uruchomienie nie tworzy duplikatów.
3. `npm run dev` — CMS i portal pod `http://localhost:8080/admin/` oraz `http://localhost:8080/`.
4. `npm run test:content:http` i `npm run test:content:browser` — wymagają lokalnego serwera na 8080, tworzą i usuwają wyłącznie własne konta, sesje i treści testowe.

Plik kopii D1 pozwala przywrócić lokalny stan sprzed importu po zatrzymaniu Wrangler. Starych plików źródłowych i integracji GitHub import nie usuwa. Wersje treści tekstowych są zapisywane w `cms_content_history`; media zachowują metadane operacji, a oryginalne obrazy pozostają w źródłowym katalogu lub kopii D1. Na produkcji należy zaplanować osobną migrację z eksportem D1 i porównaniem adresów URL, identyfikatorów i sum kontrolnych.

## Publikacja i bezpieczeństwo

Nowe ręczne artykuły są szkicami. Tylko ADMIN może nadać im status `published`; edytor może zapisywać szkice. Artykuły AI zachowują istniejące `ai_candidates` i `ai_editorial` w tej samej D1. Worker `workers/publication.mjs` sprawdza co pięć minut wyłącznie rekordy `scheduled` z `approved_by` i `approved_at`. Ponowne uruchomienie jest bezskuteczne dla już opublikowanych. Wycofanie ustawia `public_state=hidden` od razu; publiczny URL zwraca 404. Cron jest skonfigurowany w `workers/publication.wrangler.toml`, ale nie został nigdzie wdrożony. Cron Cloudflare działa w UTC; terminy redakcyjne są przeliczane z `Europe/Brussels` przez istniejący kod.

Obrazy do 4 MB są dzielone na fragmenty po 240 kB w D1. Limit pojedynczego rekordu D1 wynosi [2 MB](https://developers.cloudflare.com/d1/platform/limits/). R2 nie zostało włączone; wymaga osobnego konta/subskrypcji i rozliczania, nawet jeśli ma darmową pulę. W razie wzrostu liczby zdjęć należy ponownie ocenić D1 vs R2.

## AI i wydarzenia — aktualizacja lokalna

Lokalny proces odkrywania, kolejka CMS, weryfikacja i kalendarz są opisane w [ai-events-local.md](ai-events-local.md). Crony odkrywania są skonfigurowane jako wyłączone i nie zostały wdrożone. Wyniki Gemini pozostają w `pending_review` do decyzji administratora.

## Stripe i testy

Lokalne `.dev.vars` nie zawiera `STRIPE_SECRET_KEY=sk_test_...` ani `STRIPE_WEBHOOK_SECRET=whsec_...`, więc nie wykonano rzeczywistego wywołania Stripe. Testy D1/Cloudflare obejmują STANDARD, TOP, PREMIUM, limity miejsc, rezerwacje, Checkout w trybie mock, podpisany webhook, idempotencję, moderację, refund i wygaśnięcie. Do rzeczywistego testu należy dodać klucze testowe do ignorowanego `.dev.vars`, ustawić `STRIPE_TEST_MODE=1`, uruchomić lokalny serwer i przekierować testowy webhook Stripe CLI na lokalne `/api/ads-payment?action=webhook`. Nie używać kluczy `sk_live_` ani webhooku Live. Cennik w bazie nie był zmieniany.

W lokalnej `ads_settings` aktywny jest rynek `pl`: STANDARD 200, TOP 500, PREMIUM 1000 eurocentów za dzień (odpowiednio 2, 5 i 10 EUR). Rynki `en`, `nl`, `fr` są wyłączone. Są to ustawienia lokalnej bazy, nie potwierdzenie cennika na produkcji.

`npm test` uruchamia aktualny zestaw 25 testów Cloudflare, agenta i Gemini; `npm run lint` oraz `npm run build` są osobnymi bramkami. `npm run test:legacy` zachowuje starszy pakiet Netlify/PostgreSQL. W tym środowisku bez uprawnień do uruchomienia osadzonego PostgreSQL wszystkie jego testy zawodzą na starcie. Po uruchomieniu z dostępem do PostgreSQL 16/19 przechodzi; dwa testy przeglądarkowe oczekują elementów starego UI, a test wielojęzycznych zamówień odwołuje się do starego adaptera. Nie są to testy aktualnej ścieżki Cloudflare. Pakiet pozostaje dostępny i wymaga przepisania na D1 przed usunięciem Netlify.

## Przed produkcją

- Przygotować i przećwiczyć zdalny import z kopią D1, walidacją liczby rekordów, sum treści, URL i rollbacku na bazie preview. Nie importować bezpośrednio na produkcję.
- Uzupełnić Worker Cron agenta i niezależną walidację faktów, wydarzeń oraz budżetu Gemini. Ustawienia `dailyTarget=2`, `dailyMax=3`, `bufferDays=7` są obecnie w D1, lecz automatyczne wykonanie nie jest gotowe.
- Uzupełnić test rzeczywistego Stripe Test Mode, test mediów i wszystkich stanów reklamy w przeglądarce oraz sprawdzić procedurę zwrotów.
- Przepisać lub wycofać z uzasadnieniem stary pakiet Netlify, a następnie usunąć zależności Netlify/PostgreSQL dopiero po potwierdzeniu równoważności.
- Sprawdzić wydajność list i sitemap przy docelowej liczbie artykułów, ochronę przed CSRF, limity uploadów i logowanie błędów. Obecny `health` sprawdza D1 i wybrany backend treści.
- Skonfigurować sekrety przez Cloudflare Workers/Pages secrets, osobną produkcyjną D1, backup Time Travel, alarmy i procedurę rollbacku. Nie zapisywać sekretów w repozytorium.

System **nie jest jeszcze gotowy do wdrożenia produkcyjnego**: migracja zdalna, automatyczny agent i rzeczywisty test Stripe nadal wymagają pracy.

## Koszty orientacyjne

Według aktualnych tabel Cloudflare plan Workers Free ma 100 tys. żądań dziennie, D1 5 mln odczytanych i 100 tys. zapisanych wierszy dziennie; po przekroczeniu dziennego limitu operacje D1 przestają działać do resetu. Pages Free ma 500 buildów miesięcznie. [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [Pages](https://developers.cloudflare.com/pages/platform/limits/). Gemini 3.1 Flash Lite ma darmowy poziom, ale jego limity są zależne od projektu; poziom płatny podaje 0,25 USD za milion tokenów wejścia tekstowego i 1,50 USD za milion tokenów wyjścia. [Google AI](https://ai.google.dev/gemini-api/docs/pricing), [limity](https://ai.google.dev/gemini-api/docs/rate-limits). Stripe w Belgii podaje 1,5% + 0,25 EUR za standardową kartę EOG; inne karty i usługi mają inne stawki. [Stripe Belgium](https://stripe.com/en-be/pricing). Koszt rzeczywisty zależy od ruchu i konfiguracji kont.
