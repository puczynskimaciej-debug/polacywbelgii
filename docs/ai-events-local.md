# AI Redaktor i wydarzenia — uruchomienie lokalne

## Jedna baza i lokalny podgląd

`npm run local:d1:setup` stosuje migracje do tej samej lokalnej D1, z której korzystają Pages, CMS, agent i publikator. `npm run dev` buduje Eleventy i uruchamia Pages pod `http://localhost:8080/`; panel jest pod `/admin/`. Konto administratora pozostaje w lokalnej D1 po restarcie. Przycisk na stronie głównej otwiera miesięczny kalendarz w modalu. `/wydarzenia/` pozostaje kompatybilnym adresem otwierającym ten sam modal. Oba widoki pobierają dane z `/api/public-events`. Szkice nie są tam widoczne.

W CMS karta „Wydarzenia do zatwierdzenia” pozwala administratorowi dodać lub poprawić wydarzenie, zweryfikować stronę źródłową, zatwierdzić, odrzucić, zaplanować i wycofać. Zatwierdzenie wymaga oznaczenia weryfikacji. Publikator przyjmuje tylko zweryfikowane i zatwierdzone wydarzenia. Strona wydarzenia ma dane Schema.org Event, źródło, organizatora i datę ostatniej weryfikacji. Brak ceny nie jest interpretowany jako bezpłatny wstęp.

## Odkrywanie i limity

`npm run agent:discover:article` i `npm run agent:discover:event` uruchamiają odpowiednio wyszukiwanie wiadomości w serwisie Ambasady RP i wydarzeń Instytutu Polskiego w Brukseli. Skrypt wymaga lokalnego `agent/.dev.vars` z `GEMINI_API_KEY` oraz potwierdzenia Free Tier bez rozliczania, zawartego w parametrze uruchomienia. `.dev.vars` jest ignorowany przez Git. Nie umieszczaj klucza w poleceniu ani w dokumentacji.

Kod dopuszcza wyłącznie wskazane domeny HTTPS, ogranicza rozmiar stron, odrzuca przekierowania, stare wiadomości i niepoprawne dane wydarzeń. Zapisuje źródło, dosłowne fragmenty dowodowe, użycie modelu, błędy i historię prób w tej samej D1. Limit to maksymalnie trzy wywołania Gemini na dobę w lokalnej bazie. Każdy wynik otrzymuje `pending_review` i proponowaną datę; agent nie ma operacji zatwierdzenia ani publikacji. Po wznowieniu deduplikacja opiera się na URL źródła.

`workers/discovery.wrangler.toml` definiuje dwa osobne Crony UTC: 06:00 dla artykułów i 07:00 dla wydarzeń. Są wyłączone przez `AI_AUTOMATION_ENABLED=0` i nie zostały wdrożone. Przed ewentualnym wdrożeniem trzeba skonfigurować produkcyjne D1, sekret Workers `GEMINI_API_KEY`, potwierdzić Free Tier i jawnie włączyć automat. Cron publikacji jest osobnym Workerem. Żaden Cron nie zatwierdza treści.

Aktualny parser obsługuje dwa wybrane oficjalne źródła. Nie wykrywa jeszcze niezawodnie zmian dat, odwołań i powtórzeń wydarzeń po utworzeniu szkicu; administrator powinien ponownie otworzyć źródło przed zatwierdzeniem. Nie należy traktować automatycznych szkiców jako zweryfikowanych informacji.

## Testy

`npm test`, `npm run lint`, `npm run build` sprawdzają kod. Przy działającym lokalnym Pages na porcie 8080: `node tests/events-http-e2e.mjs`, `node tests/events-cms-browser-e2e.mjs` oraz `$env:PBE_LOCAL_PAGES_URL='http://127.0.0.1:8080'; npm run test:editorial:e2e`. Testy tworzą i usuwają własne rekordy testowe. Nie uruchamiaj bez filtra publikatora na bazie zawierającej prawdziwe zaplanowane materiały.

## Stripe Test Mode

Logika Checkout, podpisanego webhooka, trzech pakietów reklam, moderacji, idempotencji, spóźnionych płatności i zwrotów przechodzi testy z kontrolowanym adapterem. W lokalnym `.dev.vars` brak `STRIPE_SECRET_KEY=sk_test_...` i `STRIPE_WEBHOOK_SECRET=whsec_...`; rzeczywistego żądania do Stripe Test Mode nie wykonano. Aby je przeprowadzić, dodaj wyłącznie testowe sekrety do ignorowanego `.dev.vars`, ustaw `STRIPE_TEST_MODE=1`, uruchom lokalny Pages i skieruj webhook Stripe CLI na `/api/ads-payment?action=webhook`. Nie używaj kluczy Live Mode. Wymagania biznesowe dotyczące sprzedawcy, VAT i faktur pozostają do ustalenia przed produkcją.
