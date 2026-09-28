# Polacy w Belgii

Wielojęzyczny portal Eleventy z własnym CMS i systemem rezerwacji reklam.

## CMS: zwykłe konto e-mail i hasło

Panel znajduje się pod adresem **/admin/**. Użytkownik loguje się adresem e-mail i hasłem; nie potrzebuje konta GitHub. Administrator tworzy konta, zarządza rolami i blokuje dostęp w sekcji **Użytkownicy i role**.

Instrukcja konfiguracji serwera, utworzenia pierwszego administratora i odzyskania hasła: [deploy/CMS.md](deploy/CMS.md).

## Architektura

- Eleventy generuje publiczną stronę do `_site/`.
- Artykuły pozostają w `src/content/articles/`, dane strony w `src/_data/`, media w `src/Images/uploads/`.
- Przeglądarka CMS korzysta wyłącznie z API portalu. Netlify Function `cms-content` zapisuje zmiany do GitHub z technicznym tokenem serwera; Netlify automatycznie publikuje stronę.
- Funkcja `cms-auth` obsługuje logowanie, sesje, zmianę haseł i konta w prywatnym PostgreSQL.
- Funkcja `ads` obsługuje reklamę TOP (2 miejsca) i STANDARD (10 miejsc) dla każdego języka, z transakcyjną ochroną rezerwacji.
- Reklamy i konta klientów nie trafiają do repozytorium treści. Wszystkie administracyjne API sprawdzają sesję CMS po stronie serwera.
- `src/_data/languages.json` jest rejestrem języków publicznego menu i systemu reklam.

## Reklamy

CMS → **Reklamy**: ceny dzienne według języka, zamówienia, filtry, edycja terminów, akceptacja i ręczne kampanie. Formularz publiczny: **/zamow-ogloszenie/**. Instrukcja i model danych: [deploy/ADS.md](deploy/ADS.md).

## Konfiguracja

W Netlify ustaw `DATABASE_URL`, `CMS_ORIGIN`, `CMS_GITHUB_TOKEN`. Następnie z terminala mającego dostęp do bazy:

```text
npm install
npm run ads:migrate
npm run cms:migrate
npm run cms:admin
```

Hasło pierwszego konta jest pobierane interaktywnie i nie jest zapisywane w repozytorium. Szczegóły zmiennych, uprawnień tokenu i migracji wcześniejszego OAuth znajdują się w instrukcji CMS.

## Uruchomienie i weryfikacja

```text
npm run dev
npm run build
npm run lint
npm test
```

Pełny CMS lokalnie wymaga `netlify dev`, testowej bazy i odpowiednich zmiennych środowiskowych. Statyczny serwer Eleventy służy do podglądu publicznej strony.

Dotychczasowy audyt responsywności (strona, artykuły, kontakt, menu, wszystkie pierwotne sekcje CMS):

```text
npm run dev -- --port=8088
npm run test:responsive
```

Serwer uruchom w osobnym terminalu. Testy korzystają z Edge; opcjonalne `BROWSER_PATH` wskazuje Chrome/Chromium. Zrzuty ekranów i dane lokalnej bazy testowej trafiają do ignorowanego katalogu `test-results/`.
