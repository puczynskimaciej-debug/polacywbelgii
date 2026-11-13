# AI Redaktor: jeden lokalny obieg

## Uruchomienie

```powershell
npm install
npm run build
npm run local:d1:setup
npm run local:agent-secret
npm run agent:import-first
npm run local:admin
npm run local:pages
```

`local:admin` prosi interaktywnie o e-mail i hasło, tworząc konto tylko w lokalnej D1. Nie zmienia istniejących kont.

Ostatnia komenda uruchamia istniejący CMS pod `http://127.0.0.1:8791/admin/`. Wrangler, agent, kalendarz CMS, historia i `npm run agent:publish-local` używają tej samej lokalnej D1 w `.local/wrangler/`. Skrypt `local:d1:setup` zawsze przekazuje Wranglerowi `--local` i `--persist-to`; nie łączy się z produkcyjną D1. Schemat opiera się na istniejących tabelach CMS oraz migracjach `001_agent.sql` i `002_editorial.sql`. Pierwszy artykuł otrzymuje `pending_review`, bez publicznego pliku. Lokalny plik SQLite z poprzedniego prototypu został usunięty po imporcie. `.local/agent/state.json` pozostaje buforem odkrytych tematów, a nie bazą decyzji redakcyjnych; synchronizacja używa `INSERT OR IGNORE`, więc nie nadpisuje decyzji administratora.

`npm run test:editorial:e2e` wymaga działającego `local:pages` oraz Microsoft Edge lub `BROWSER_PATH`. Test tworzy tymczasowego lokalnego administratora i materiały oznaczone jako testowe, używa prawdziwego panelu i endpointów Pages, uruchamia lokalny publikator i sprząta po teście. Nie zmienia żadnego istniejącego konta. Aby zalogować się samodzielnie do lokalnego CMS, trzeba utworzyć lokalne konto administratora w lokalnej D1; kont produkcyjnych nie kopiowano. Testowy administrator nie jest pozostawiany w bazie.

## Zasady publikacji

Techniczny AGENT używa losowego `AGENT_SERVICE_TOKEN` z ignorowanego przez Git `.dev.vars`; nie ma hasła CMS. Tylko ADMIN może zaakceptować, zaplanować, odrzucić lub wycofać materiał. API zapisuje historię, identyfikator administratora i czas akceptacji. Terminy podaje się w czasie `Europe/Brussels`, D1 przechowuje UTC. Nieistniejące godziny przy zmianie czasu są odrzucane, a powtórzona godzina wymaga wskazania `fold` w API. Unikalny indeks blokuje dwa artykuły w tym samym terminie.

Publikator czyta zatwierdzone i wymagalne rekordy **z tej samej D1**. Tworzy plik Markdown w katalogu istniejącego CMS, uruchamia Eleventy, sprawdza HTML, zapisuje rzeczywisty czas publikacji i dopiero wtedy ustawia `published`. Ponowne uruchomienie nie duplikuje artykułu. Wycofanie usuwa plik i wygenerowany HTML, a po buildzie stan publiczny zmienia się na ukryty. Pages Function dla `/artykuly/ai-.../` zwraca 404, dopóki D1 nie ma `published` i `visible`; chroni to również przed stroną zastępczą Pages pod nieopublikowanym URL. Wygenerowana lista artykułów jest aktualizowana przez build. Projekt nie generuje sitemap ani RSS.

## Gemini

Lokalny generator czyta `GEMINI_API_KEY` z `agent/.dev.vars`. Plik jest ignorowany przez Git. Zmienna środowiskowa o tej samej nazwie ma pierwszeństwo. Nie wklejaj wartości klucza do kodu, komendy w historii ani do rozmowy. Po potwierdzeniu, że projekt Google AI Studio jest w Free Tier bez rozliczania, ustaw w bieżącej sesji PowerShell:

```powershell
$env:GEMINI_FREE_TIER_CONFIRMED = '1'
```

W tym samym oknie uruchom `npm run agent:generate -- <id-zweryfikowanego-materiału>`. Generator wymaga oficjalnego materiału z zapisanymi twierdzeniami, sprawdza linki źródłowe i limit kolejki w D1, a wynik zapisuje do `pending_review`. Nie publikuje. Model nie zastępuje ręcznej weryfikacji faktów. Test z rzeczywistym Gemini 3.1 Flash Lite zakończył się sukcesem 10 listopada 2026 r. Tekst po sprawdzeniu źródeł i korekcie redakcyjnej zapisano w lokalnej D1; skrypt `agent/check-cms-queue.mjs <id>` potwierdza widoczność w CMS i publiczne HTTP 404. Przed każdym kolejnym tematem trzeba przygotować zweryfikowane dane wejściowe, a następnie sprawdzić wynik modelu przed akceptacją.

## Architektura docelowa Cloudflare — bez wdrożenia

1. **Cron agenta:** Worker z zaplanowanym wywołaniem zbiera źródła, stosuje limity i zapisuje kandydatów oraz uruchomienia w produkcyjnej D1 przez tę samą warstwę reguł. `GEMINI_API_KEY` i `AGENT_SERVICE_TOKEN` będą sekretami Workers, bez zapisu w Git.
2. **Cron publikacji:** drugi harmonogram wybiera zatwierdzone, wymagalne rekordy w D1. Wymaga blokady lub dzierżawy zadania, aby dwa przebiegi nie uruchomiły równocześnie builda.
3. **Aktualizacja strony:** D1 nie tworzy statycznego HTML. Zaufany proces budujący musi pobrać zatwierdzone treści, zbudować Eleventy, uruchomić deploy Pages i potwierdzić publiczny URL. Dopiero potwierdzenie zmienia status na `published`. Wycofanie wymaga nowego builda i potwierdzenia 404. Nie wolno uruchamiać deployu bez tej sekwencji i kontroli błędów.
4. **Obserwowalność:** identyfikator zadania, błędy pobierania/modelu/builda/deployu i czasy zapisuje się w `ai_runs` oraz dzienniku decyzji; logi Workers nie zawierają sekretów ani pełnych danych uwierzytelniających.

Nie skonfigurowano produkcyjnego Cron, produkcyjnej D1 ani automatycznego deployu. Lokalny publikator korzysta z plików na tym komputerze; produkcja wymaga osobnego trwałego procesu budującego i potwierdzenia publikacji.
