# System reklam — konfiguracja i obsługa

## Zamówienie w popupie

Przyciski zamawiania otwierają dialog bez opuszczania strony. Język interfejsu odpowiada językowi strony, a języki publikacji są osobnym wyborem PL/NL/FR, z polskim na pierwszym miejscu. Zamawiający wybiera format i do 90 pojedynczych dni, następnie podaje tekst (400 znaków na język), wspólny kontakt publiczny (160 znaków) i prywatny e-mail. Obraz, nazwa firmy i adres WWW nie są wymagane dla nowych ogłoszeń tekstowych.

`order-batch` rezerwuje wszystkie języki i dni w jednej transakcji. Każdy język/dzień ma osobną pozycję w CMS i wspólny `groupId`. Ponowienie identycznego żądania nie tworzy duplikatu. Serwer ponownie sprawdza cennik i dostępność, a prywatny e-mail nie trafia do publicznego API. Zamówienia pozostają nieopłacone i oczekujące; płatności online nie są podłączone.

TOP wyświetla dwie kolumny nad hero (jedną na telefonie). W CMS wybór edytowanego języka filtruje zamówienia i cennik. Istniejące reklamy obrazkowe pozostają obsługiwane.

## Architektura

Eleventy nadal generuje stronę, artykuły i istniejący CMS używają GitHub Contents API. Reklamy korzystają z Netlify Function `ads` oraz **prywatnego PostgreSQL**. Danych klientów nie zapisujemy do publicznego repozytorium. Każde wywołanie administracyjne sprawdza sesję konta CMS (e-mail i hasło). Logowanie oraz konta są opisane w [CMS.md](CMS.md). GitHub jest wyłącznie magazynem treści obsługiwanym przez backend.

`src/_data/languages.json` jest wspólnym rejestrem języków menu strony, formularza, CMS i API. Przy dodawaniu języka dodaj również jego tłumaczenia w istniejącym `src/script.js` oraz w `src/ads-i18n.js`. Nowy rynek domyślnie nie przyjmuje zamówień.

Kwoty przechowujemy w eurocentach, daty jako `YYYY-MM-DD`, pierwszy i ostatni dzień są wliczone. Dzień emisji wyznacza `Europe/Brussels`. Maksymalny zakres: 366 dni, do dwóch lat od dzisiaj. Typy i limity są opisane w ustawieniach domenowych; CMS edytuje obecnie ceny i dostępność rynków, nie limity.

Wszystkie zapisy zamówień i cennika korzystają z transakcji na jednym połączeniu oraz blokady wiersza ustawień `FOR UPDATE`. Odczyt dostępności następuje po uzyskaniu blokady. To celowe uproszczenie dla 12 miejsc na język: serializuje zapisy także pomiędzy instancjami Netlify. Nie zapisuj zamówień bezpośrednio do tabel z innych aplikacji, omijając tę ścieżkę.

Zamówienia `pending` oraz `approved` rezerwują miejsca. `rejected` i `cancelled` ich nie rezerwują. Akceptacja nie oznacza płatności. `scheduled`, `active`, `ended` są statusami obliczanymi dla zaakceptowanej reklamy. Oczekujące zgłoszenie pozostaje do decyzji redakcji, bez automatycznego zwalniania przed końcem terminu. Zmiana terminu ponownie sprawdza pojemność, zachowuje dzienną stawkę i przelicza sumę. Język i typ istniejącego zamówienia są stałe; w razie zmiany rynku należy anulować zamówienie i utworzyć nowe.

API publiczne zwraca wyłącznie aktualnie emitowane reklamy i zagregowaną dostępność. Nie publikuje danych kontaktowych ani numerów innych zamówień. API oraz przeglądarka nie buforują odpowiedzi. Strona odświeża emisję co minutę i po powrocie do karty; zmiana języka natychmiast usuwa stary zestaw. Nie potrzeba zadań cron ani codziennych buildów. Przy awarii API sekcje reklam są ukryte, a zamawianie pokazuje błąd.

Grafiki PNG/JPEG/WebP do 500 KB są przechowywane razem z zamówieniem w prywatnej bazie. API sprawdza format, sygnaturę i rozmiar; SVG nie są dozwolone. Dla większej skali można zastąpić to magazynem obiektowym, zachowując model zamówienia. Pola `paymentStatus`, `paymentId`, `paymentProvider`, `paidAt` istnieją, lecz żadna bramka nie jest podłączona. Zapis klienta zawsze kończy się `pending` / `unpaid`.

## Uruchomienie na Netlify

Listy reklam są pobierane bez zawartości obrazów. Każdy obraz jest przesyłany osobnym żądaniem, aby komplet reklam nie przekroczył limitu wielkości odpowiedzi Netlify. Publiczny endpoint obrazów udostępnia wyłącznie obrazy aktywnych reklam; podgląd innych grafik wymaga autoryzacji CMS.

1. Utwórz prywatną bazę PostgreSQL u wybranego dostawcy. Wybierz adres połączenia obsługujący transakcje; zalecane jest połączenie przez pooler dostawcy z TLS.
2. Ustaw w Netlify **Functions → Environment variables** zmienną `DATABASE_URL` na pełny adres PostgreSQL zgodnie z instrukcją dostawcy (włącznie z parametrami TLS). Nie umieszczaj hasła w repozytorium ani plikach publicznych.
3. Ustaw tę samą zmienną w lokalnej sesji terminala i wykonaj `npm run ads:migrate`. Skrypt tworzy trzy tabele i indeks; jest powtarzalny i nie usuwa danych. Użyj osobnej bazy do testów przedprodukcyjnych.
4. Skonfiguruj konta CMS zgodnie z [CMS.md](CMS.md), wykonaj migrację kont i utwórz pierwszego administratora.
5. Opublikuj kod standardowym mechanizmem Netlify. Logowanie używa nowej konfiguracji CMS.
6. Wejdź w `/admin/`, zaloguj się e-mailem i hasłem, wybierz **Reklamy**. Wpisz ceny TOP i STANDARD w EUR dla każdego rynku, włącz zamówienia i kliknij **Zapisz ceny**. Początkowo wszystkie rynki są wyłączone, bez przykładowych płatnych stawek.

Na tym etapie kod nie został opublikowany na produkcji. Sam build statyczny nie uruchamia API. Lokalny pełny serwis wymaga `netlify dev` oraz testowego `DATABASE_URL`; `npm run dev` służy do statycznego podglądu.

## Sprawdzenie zamówienia

1. Na stronie głównej kliknij **Zamów ogłoszenie** albo otwórz `/zamow-ogloszenie/`.
2. Wybierz język, typ i daty. Kalendarz pokazuje wolne miejsca każdego dnia; choć jeden pełny dzień blokuje zakres.
3. Dodaj dane i grafikę do 500 KB, zaznacz zgodę, otwórz podsumowanie i wyślij. Zapisz wyświetlony numer. Ponowienie tego samego żądania po problemie sieciowym nie tworzy drugiej rezerwacji.
4. W CMS → **Reklamy** wybierz filtr **Oczekuje**, otwórz **Szczegóły / edycja**, ustaw **Zaakceptowane** i zapisz. Reklama pokaże się automatycznie w swoim terminie i języku.
5. Sprawdź przełączanie języka oraz emisję TOP/STANDARD. Anulowanie albo odrzucenie od razu zwalnia terminy. Zmiana ceny nie zmienia wcześniej zapisanych stawek.
6. **Dodaj ręcznie** pozwala utworzyć kampanię płatną, partnerską albo bezpłatną. Pole **Bezpłatna / barter** ustawia 0 EUR. Obowiązują te same limity dzienne.

## Testy

- `npm run build` — generowanie całego portalu.
- `npm run lint` — ESLint całego kodu JavaScript.
- `npm test` — prawdziwy lokalny PostgreSQL (port 55439), testy API, jednoczesnych rezerwacji i scenariusz przeglądarkowy (port 8089). Baza testowa tworzy się wyłącznie w `test-results/postgres-*`, bez używania produkcyjnego `DATABASE_URL`. Pliki pozostają do diagnostyki. Testy nie dotykają prawdziwego GitHub; autoryzacja korzysta z kont i sesji w izolowanej bazie testowej.
- `npm run dev -- --port=8088`, a w drugim terminalu `npm run test:responsive` — istniejący audyt artykułów, kontaktu, menu i CMS (55 kontroli).

Testy przeglądarkowe domyślnie używają lokalnego Edge na Windows. `BROWSER_PATH` pozwala wskazać Chrome/Chromium w innym środowisku. Zrzuty nowych widoków trafiają do `test-results/ads-*.png`.

Dokumentacja mechanizmu: [blokady wierszy PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS) i [transakcje node-postgres](https://node-postgres.com/features/transactions).
