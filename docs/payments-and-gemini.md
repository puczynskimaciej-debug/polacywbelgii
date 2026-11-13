# Lokalny artykuł, Gemini i płatności testowe

## Artykuł w portalu

Artykuł pozostaje w `.local/drafts/ilu-polakow-mieszka-w-belgii.md` oraz lokalnej D1 jako `pending_review`. Nie jest widoczny na stronie publicznej. Aktualna procedura moderacji i publikacji jest w [editorial-workflow.md](editorial-workflow.md).

Liczba 43,9 tys. nie występuje w artykule. Bezpośrednio potwierdzone liczby brukselskie pochodzą z IBSA. Artykuł pozostaje szkicem wymagającym akceptacji i ewentualnego uzupełnienia o bezpośrednio sprawdzony szacunek dla całej Belgii.

## Gemini

`agent/gemini.mjs` wywołuje serwerowo Google GenerateContent API. Domyślny model to `gemini-2.5-flash`, zmieniany przez `GEMINI_MODEL`. Moduł wymaga `GEMINI_API_KEY` oraz `GEMINI_FREE_TIER_CONFIRMED=1`; bez obu nie wysyła żądania. Nie ma klucza w repozytorium ani frontendzie. Żądania mają timeout, ograniczone ponawianie i limit długości odpowiedzi. Wynik jest walidowany i zawsze oznaczany do ręcznej weryfikacji.

`npm run agent:generate -- <id>` wybiera tylko oficjalny, zweryfikowany materiał z twierdzeniami i zapisuje wynik jako nowy lokalny szkic. Nie modyfikuje publicznego katalogu artykułów. Sam model nie weryfikuje prawdziwości treści. Gemini 2.5 Flash może nie być dostępny dla nowego projektu; wtedy należy świadomie ustawić dostępny model w `GEMINI_MODEL`.

## Obecny system reklam

Istniejący formularz wybiera język, typ STANDARD/TOP/PREMIUM, daty i treść, pokazuje kalendarz, cenę oraz podsumowanie. Ceny w centach EUR przechowuje `ads_settings`; serwer wylicza kwotę i sprawdza przesłaną cenę. Limity miejsc: STANDARD 10, TOP 2, PREMIUM 1 na dzień i język. Rezerwacje zapisuje `ad_orders`. STANDARD jest tekstowy, PREMIUM graficzny (1200×200 i 660×300), TOP może być tekstowy lub graficzny. Obrazy PNG/JPEG/WebP do 500 KB są walidowane po stronie serwera. Panel CMS zarządza zamówieniami i cennikiem.

## Stripe Test Mode

Nowy endpoint `/api/ads-payment` tworzy Checkout Session po zapisaniu rezerwacji. Serwer bierze kwotę z zapisanych zamówień, a nie z formularza. Wymagane są `STRIPE_TEST_MODE=1`, `STRIPE_SECRET_KEY=sk_test_…` i `STRIPE_WEBHOOK_SECRET=whsec_…`. Klucze `sk_live_` są odrzucane. Dla lokalnego Cloudflare Pages można użyć ignorowanego przez Git `.dev.vars`; nie wklejaj kluczy do kodu ani do rozmowy. Dodatkowo trzeba zastosować `deploy/cloudflare-d1-0003-stripe.sql` do **lokalnej/testowej** D1. Migracja tworzy tabelę zdarzeń i nie zmienia istniejących reklam.

Po rezerwacji klient trafia na stronę Stripe. Przekierowanie powrotne pokazuje status pobrany z serwera, ale samo nie oznacza zapłaty. Webhook weryfikuje HMAC podpisu nad surowym żądaniem, odrzuca zdarzenia Live Mode, porównuje identyfikator sesji, walutę i kwotę oraz zapisuje identyfikator zdarzenia. Powtórzone zdarzenie jest idempotentne. Po potwierdzeniu płatności reklama nadal czeka na moderację. Tylko opłacona i zaakceptowana reklama może być aktywna. Wygasła rezerwacja zwalnia miejsce; spóźniona płatność trafia do `paid_late`, blokuje emisję i wymaga ręcznego zwrotu. Zwrot Stripe oznacza zamówienie jako `refunded` i ukrywa reklamę. Migracja dodaje także historię ręcznych zmian zamówień.

Panel CMS pokazuje status płatności, moderacji, identyfikatory Stripe, sygnał wymaganego zwrotu i historię zdarzeń. Klient może sprawdzić status przez identyfikator zamówienia i lokalny token przechowywany w sesji przeglądarki. Utrata tego tokenu wymaga kontaktu z redakcją.

## Testy i ograniczenia

`node --test tests/cloudflare.test.mjs tests/gemini.test.mjs` sprawdza lokalną bazę zgodną z D1, wszystkie trzy pakiety, limity, grafikę, ceny, podpis webhooka, płatność, moderację, duplikat zdarzenia, nieudaną i spóźnioną płatność oraz zwrot. Odpowiedź Stripe jest zastąpiona kontrolowanym testowym adapterem, bo klucze Stripe nie są skonfigurowane. Nie wykonano rzeczywistego żądania do Stripe Test Mode ani Gemini. Lokalny statyczny Eleventy używa istniejącego demonstracyjnego formularza reklam; pełny Checkout wymaga lokalnego Pages/D1 i testowych sekretów.

Przed sprzedażą trzeba ustalić dane sprzedawcy, zasady VAT, fakturowania, regulamin i informacje dla klienta. Te decyzje nie są automatyzowane. Nie ma automatycznego zwrotu spóźnionej płatności ani automatycznej publikacji reklamy. Stripe Live Mode i produkcyjna D1 pozostają nietknięte.
