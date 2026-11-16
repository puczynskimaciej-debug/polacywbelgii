# Bramka produkcyjna — stan 16.11.2026

To jest lista decyzji do zatwierdzenia, a nie oświadczenie o zawartych umowach lub aktywacji usług.

## Wdrożenie i izolacja

- Projekty `polacywbelgii` i `polacywbelgii-test` korzystają z tego samego repozytorium i gałęzi `cloudflare-migration`.
- Cloudflare zapisywał zdarzenie GitHub `github:push` w starym projekcie jako zadanie `queued`; wcześniejsze zadanie ma `skip_reason=production_deployments_disabled`. Nie był to build. Workflow `.github/workflows/deploy.yml` uruchamia GitHub Pages tylko dla `main` i nie wywołuje Cloudflare. Źródłem zdarzenia nie był deploy hook.
- Stary projekt ma teraz `deployments_enabled=false`, `production_deployments_enabled=false`, `preview_deployment_setting=none`; TEST pozostaje włączony. Nie wykonano próbnego pusha.
- Domyślny `wrangler.toml` jest konfiguracją TEST. Przy wydaniu produkcyjnym nie wolno go stosować do starego projektu: wskazuje testową bazę. Osobny `wrangler.production.toml` zawiera prawidłową produkcyjną D1 i wyłączone Stripe/AI. Przed wydaniem uruchomić `node scripts/check-pages-release-config.mjs` i użyć odizolowanego katalogu wydania, w którym **produkcyjny plik** zostanie zapisany pod nazwą `wrangler.toml`. Bieżąca wersja Wrangler Pages nie udostępnia `--config` w `pages deploy`; nie zakładać, że sama nazwa `wrangler.production.toml` zostanie odczytana.
- Przed wdrożeniem kodu: zatwierdzić polityki, wykonać nowy backup produkcyjnej D1, sprawdzić schemat i zastosować brakującą migrację `cloudflare-d1-0004-retention.sql` do produkcyjnej D1. Kod API kontaktu odwołuje się do `closed_at`, więc odwrotna kolejność spowoduje błąd. Automatyczna retencja produkcyjna pozostaje wyłączona.

## Dostawcy — stan techniczny i dokumenty

| Dostawca | Potencjalne dane | Rola i dokument do potwierdzenia | Dalsze działanie |
| --- | --- | --- | --- |
| Cloudflare Pages/Workers/D1/DNS/Turnstile | IP i żądania HTTP, formularze kontaktowe, zamówienia, konta/sesje CMS, logi; Turnstile może otrzymać IP i sygnały urządzenia, jeśli zostanie włączony | Dla powierzonych danych Cloudflare występuje jako procesor na zasadach [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/); role w innych usługach sprawdzić w umowie konta | Potwierdzić obowiązywanie DPA, podwykonawców i transfery. D1 obu środowisk ma `jurisdiction=null`; region EEUR/WEUR nie stanowi gwarancji jurysdykcji EU. [Jurysdykcję D1 można wybrać tylko przy tworzeniu bazy](https://developers.cloudflare.com/d1/configuration/data-location/). |
| GitHub | Kod, historia commitów, identyfikatory autorów; D1 jest backendem CMS, więc zamówienia i wiadomości nie powinny być wysyłane do repozytorium | GitHub opisuje odrębne role w [polityce prywatności](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement); [DPA](https://github.com/customer-terms/github-data-protection-agreement) dotyczy wskazanych planów biznesowych | Potwierdzić plan konta, zakres DPA, dostęp integracji GitHub oraz brak danych osobowych i sekretów w historii repozytorium. |
| Stripe Checkout | Po aktywacji: e-mail klienta, kwota, opis zamówienia, ID, dane płatnicze podawane Stripe i dane urządzenia | Stripe działa jako procesor **i** odrębny administrator dla części celów; [DPA](https://stripe.com/legal/dpa) jest częścią umowy usługowej | Obecnie Checkout jest wyłączony. Przed aktywacją potwierdzić konto, umowę, transfery, webhook, okres dokumentacji płatniczej i treść polityki. |
| Google Gemini | Po aktywacji: wpisane prompty, treść reklam do tłumaczenia, ewentualne dane osobowe w tych tekstach | [Warunki Gemini](https://ai.google.dev/gemini-api/terms) rozróżniają zasady usług płatnych i bezpłatnych | AI automatyczne i publiczne tłumaczenie pozostają wyłączone. Warunki dopuszczają udostępnianie klienta API osobom w EOG tylko w ramach Paid Services; nie włączać publicznej funkcji na Free Tier. Potwierdzić projekt z rozliczaniem i warunki przetwarzania przed aktywacją. [Google opisuje też przechowywanie danych do monitorowania nadużyć](https://ai.google.dev/gemini-api/docs/usage-policies). |
| Poczta i domena | Wiadomości kierowane na adres kontaktowy, metadane e-mail, dane rejestracyjne domeny | Do ustalenia na podstawie paneli właściciela, nie tylko rekordów DNS | Potwierdzić faktycznego dostawcę skrzynki, rejestratora domeny, umowy, lokalizacje i przekierowania. |

## Proponowana retencja do zatwierdzenia

| Kategoria | Propozycja | Wyjątek / uzasadnienie |
| --- | --- | --- |
| Kontakt | 12 miesięcy od udokumentowanego zamknięcia sprawy | Otwarta sprawa, reklamacja lub spór zatrzymują usunięcie. Potwierdzić, czy 12 miesięcy wystarcza na ewentualne roszczenia. |
| Historia AI | 30 dni od wpisu / zakończenia zadania | Wpisy powiązane z aktywną sprawą lub blokadą pozostają. Nie przekazywać do Gemini zbędnych danych osobowych. |
| Sesje CMS | Maksymalnie 8 godzin; usuwać po wygaśnięciu | Sesja może zostać unieważniona wcześniej. |
| Logi bezpieczeństwa | 90 dni | Potrzebny mechanizm wstrzymania usuwania logów objętych incydentem lub sporem przed włączeniem produkcyjnego Crona. |
| Nieopłacone zamówienia anulowane/odrzucone | 12 miesięcy od zamknięcia sprawy | Wyłącznie bez zdarzenia płatniczego i aktywnego sporu/reklamacji. |
| Opłacone zamówienia i dokumenty podatkowe | Nie ustawiać automatycznego sztywnego okresu; dla dokumentów podatkowych zwykle do upływu przedawnienia zobowiązania: co do zasady 5 lat od końca roku, w którym minął termin płatności podatku | Termin może się zawiesić lub przerwać; faktury w KSeF mają odrębne zasady. Właściciel/księgowy/prawnik musi ustalić dokumentację, datę `retentionUntil`, reklamację, chargeback i roszczenia. [Ministerstwo Finansów](https://www.podatki.gov.pl/abc-podatkow/uprawnienia-i-obowiazki-podatnika/). |
| Backupy | D1 Time Travel: według planu 7 dni (Free) lub 30 dni (Paid); osobne eksporty: proponowany maks. 30 dni od wykonania, szyfrowanie, ograniczony dostęp i usunięcie po zakończeniu celu | Eksport obejmuje również dane usunięte później z aktywnej bazy. Potwierdzić plan Cloudflare i ewidencję kopii. Nie trzymać pełnego eksportu z danymi osobowymi przez okres dokumentacji podatkowej; dokumenty podatkowe wydzielić. [Limity D1](https://developers.cloudflare.com/d1/platform/limits/). |

Podstawą ograniczenia przechowywania oraz wyjątków dla obowiązku prawnego i obrony roszczeń są [art. 5 i 17 RODO](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/). TEST realizuje pierwsze pięć kategorii według testowych okresów. Produkcyjny Worker retencji nie jest wdrożony. W jego obecnym kodzie nie ma odrębnej blokady incydentowej dla logów bezpieczeństwa; jest to dodatkowa bramka przed włączeniem produkcyjnego czyszczenia.

## Dane i potwierdzenia od właściciela

1. Potwierdzenie pełnych danych firmy z polityk PL/NL/FR/EN, adresu do żądań RODO, podmiotu wystawiającego faktury i właściwej jurysdykcji podatkowej.
2. Akceptacja okresów i definicji zamknięcia sprawy; decyzja, kto oznacza reklamacje, spory, incydenty i obowiązki podatkowe oraz kiedy zwalnia blokady.
3. Informacja o planie Cloudflare, wszystkich ręcznych eksportach/backupach i ich miejscu przechowywania; decyzja o szyfrowaniu, dostępie i kasowaniu.
4. Potwierdzenie warunków Cloudflare, dostawcy poczty i rejestratora, ich DPA i transferów; planu GitHub oraz zakresu integracji.
5. Decyzja, czy i kiedy uruchamiać Stripe i Gemini. Dla udostępnienia Gemini użytkownikom w EOG wymagana jest weryfikacja Paid Services i warunków przetwarzania.
6. Weryfikacja przez właściciela/prawnika/księgowego czterech projektów polityki prywatności i polityki cookies przed wydaniem produkcyjnym.
