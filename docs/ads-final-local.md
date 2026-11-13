# System ogłoszeń — lokalny model i testy

## Emisja i rezerwacja

- Limity na każdą wersję językową: PREMIUM 2, TOP 5, STANDARD 30. Ceny bazowe nadal pochodzą z `ads_settings` w D1.
- Formularz wysyła jedną grupę wersji językowych. Pierwszy wybrany język kosztuje pełną cenę pakietu za cały okres, każdy dodatkowy 50% tej ceny (zaokrąglenie do najbliższego centa). Serwer sprawdza kwotę i dostępność wszystkich języków; zapis w D1 jest atomowy.
- Każdy wykupiony dzień oznacza 24 godziny. Przyszły start to północ w `Europe/Brussels`, przeliczona na UTC. Koniec powstaje przez dodanie liczby godzin, także przy zmianie czasu. Dla terminu „dzisiaj” start jest ustalany dopiero przy akceptacji po potwierdzeniu płatności.
- Rezerwacja na Checkout wygasa, jeśli nie zostanie opłacona. Spóźniona płatność nie uruchamia emisji i wymaga ręcznego zwrotu. Spóźniona moderacja przyszłego terminu wymaga jawnego wyboru nowej daty w CMS albo zwrotu.
- Publiczne API zwraca tylko aktywne reklamy opłacone i zatwierdzone oraz jawnie bezpłatne reklamy dodane przez administratora. Daty emisji są sprawdzane przy każdym żądaniu. Odpowiedź ma `Cache-Control: no-store`; otwarta strona usuwa reklamę lokalnie w chwili wygaśnięcia.
- Tłumaczenia wpisuje klient ręcznie i administrator może je edytować. Treści zamówień nie są wysyłane do Gemini bez osobnej podstawy i informacji dla użytkownika.

## Lokalnie

1. `npm run local:d1:setup` stosuje migracje tylko do `.local/wrangler`, w tym tabelę zdarzeń Stripe i historię reklam.
2. `npm run ads:demo-local` zapewnia 2 przykładowe banery PREMIUM i 5 kart TOP dla każdego języka w ignorowanym przez Git pliku `.local/demo-ads.json`. Wszystkie przykłady mają oznaczenie DEMO; nie są płatnymi zamówieniami.
   Eleventy usuwa stare kopie plików DEMO z `_site` przed każdym buildem. Build z `CF_PAGES=1` ich nie kopiuje, także gdy wcześniej wykonano build lokalny.
3. `npm run dev` buduje stronę i uruchamia lokalny CMS na `http://localhost:8080/admin/`. Publiczne reklamy są widoczne też pod `/ogloszenia/`.
4. Testy: `npm test`, `npm run lint`, `npm run build`, `npm run test:calendar-ads:browser`, `npm run test:ads:cms:browser`, `npm run test:responsive`, `npm run test:legal:browser`. Test CMS tworzy losowe konto i ogłoszenie wyłącznie w lokalnej D1, a na końcu je usuwa.

## Stripe

Lokalne `.dev.vars` nie ma obecnie testowych sekretów Stripe. Testy jednostkowe używają kontrolowanego adaptera Checkout i podpisanego webhooka; nie wykonują płatności. Rzeczywisty test wymaga `STRIPE_TEST_MODE=1`, `STRIPE_SECRET_KEY=sk_test_…` oraz `STRIPE_WEBHOOK_SECRET=whsec_…` w ignorowanym pliku `.dev.vars`, a także przekierowania webhooka testowego do `/api/ads-payment?action=webhook`. Nie używać kluczy `sk_live_`.

Przed sprzedażą produkcyjną pozostają: rzeczywisty test Stripe Test Mode i procedury zwrotów, zatwierdzenie regulaminu i polityki prywatności, dane sprzedawcy/VAT/fakturowanie oraz osobna migracja i wdrożenie produkcyjne. Żaden z tych kroków nie został wykonany lokalnymi testami.
