# Retencja D1 i bramka wydania

## Izolacja środowisk

- TEST: osobny Worker `polacywbelgii-retention-test`, binding `DB` do `polacywbelgii-test` (`76deb616-3e1d-4a64-9c68-7275336a91d4`). Harmonogram w `wrangler.retention-test.toml` uruchamia czyszczenie codziennie o 03:00 UTC. Przed ustawieniem docelowego harmonogramu sprawdzono rzeczywiste automatyczne uruchomienie co 5 minut na danych syntetycznych.
- PRODUKCJA: plik `wrangler.retention-production.example.toml` jest tylko wzorem. Ma dwie niezależne blokady `RETENTION_ENABLED=0` i `RETENTION_PRODUCTION_APPROVED=0`. Nie wdrażać go ani nie wykonywać migracji produkcyjnej bez decyzji właściciela.
- Worker nie ma publicznej trasy HTTP. Nie zawiera Stripe ani zadań AI. Poza kontem TEST nie ma automatycznego usuwania.

## Co usuwa zadanie

Konfiguracja jest w tabeli `retention_policy`, osobno dla sześciu kategorii. Właściciel zatwierdził poniższe okresy jako zasady operacyjne, z pierwszeństwem nadrzędnych wymogów prawa. Na produkcji automatyczny Worker pozostaje wyłączony.

| Kategoria | Konfiguracja TEST | Warunek i działanie |
| --- | --- | --- |
| Kontakt | 365 dni | Usunięcie całej wiadomości dopiero po `closed_at`; sprawa otwarta lub aktywna blokada są zachowane. |
| Historia AI | 30 dni | Usunięcie starych wpisów i zakończonych zadań; aktywne zadanie lub blokada rozmowy wstrzymują usunięcie. |
| Sesje CMS | 0 dni po wygaśnięciu | Usunięcie tokenu sesji, gdy minie `expires_at`; samo uwierzytelnienie wygasa po maks. 8 godzinach. |
| Logi bezpieczeństwa | 90 dni | Usunięcie `cms_audit`, `cms_login_limits`, `ad_rate_limits` i starych dzienników retencji, z wyłączeniem zakresów objętych aktywną blokadą incydentu lub obowiązku dowodowego. |
| Nieopłacone zamówienia | 365 dni | Tylko anulowane/odrzucone, po jawnym zamknięciu sprawy, bez zdarzeń płatniczych i bez blokady; usuwane razem z `ad_order_history`. Cała grupa językowa jest oceniana razem. |
| Opłacone zamówienia | wyłączone | Kod obsługuje przyszły, zatwierdzony okres oraz indywidualne `retentionUntil`; przed ich ustawieniem zachowuje zamówienie i zdarzenia Stripe. |

Nie stosujemy pozornej anonimizacji. Po spełnieniu warunków rekord i jego dane identyfikujące są usuwane; w dzienniku pozostają wyłącznie liczby i kody błędów. Konto CMS, opublikowana treść i historia redakcyjna nie są objęte automatycznym usuwaniem w tej wersji, ponieważ wymagają odrębnej decyzji o celu i terminie.

## Obsługa i monitoring

- `GET /api/retention` wymaga zalogowanego administratora. Zwraca dry-run (same liczby), konfigurację oraz 10 ostatnich uruchomień. Niczego nie kasuje.
- `POST /api/retention` umożliwia administratorowi zamknięcie/otwarcie sprawy kontaktowej, zamknięcie grupy zamówienia oraz ustanowienie/zwolnienie blokady (`open_case`, `complaint`, `dispute`, `tax`, `legal_other`). Nie wysyła do logów treści sprawy.
- `security_log_holds` przechowuje wyłącznie zakres czasu i kod `incident`/`legal_evidence`. Administrator ustanawia lub zwalnia blokadę w CMS. Dry-run oraz samo `DELETE` sprawdzają zakres, aby blokada zapisana po wyborze kandydata również chroniła wpis. Blokada bez końca zakresu chroni też późniejsze logi do czasu zwolnienia.
- `retention_lock` z 15-minutową dzierżawą zapobiega równoległym uruchomieniom. Przetwarzanie jest porcjowane; kolejne uruchomienie usuwa następną porcję. Zapisy powiązanych rekordów zamówień wykonuje transakcja D1.
- `retention_runs` przechowuje stan `completed`/`failed`, liczniki i bezpieczny kod błędu. Błąd jest zgłaszany również w logu Workera bez treści rekordu. Monitorować nieudane przebiegi i brak przebiegu w oczekiwanym oknie.
- Migracje `cloudflare-d1-0004-retention.sql` i `cloudflare-d1-0005-security-log-holds.sql` wymagają wcześniejszego backupu. Na produkcji nie zostały wykonane. Procedura jest w `PRODUCTION_DEPLOY_RUNBOOK.md`.

## Kwestie właściciela przed produkcją

1. Okresy operacyjne zostały zatwierdzone. Potwierdzić osoby odpowiedzialne za zamykanie spraw, oznaczanie i zwalnianie blokad oraz obsługę żądań osób, których dane dotyczą.
2. Ustalić dokumentację podatkową/księgową i datę `retentionUntil` dla opłaconych transakcji, uwzględniając przedawnienie, ewentualne przerwy i spory. Nie wpisywać automatycznie sztywnego terminu do produkcji.
3. Zweryfikować umowy i role dostawców: Cloudflare (Pages/D1/DNS), OVHcloud (rekordy MX poczty), GitHub (kod i ewentualnie historia), Stripe (po aktywacji Checkout), Google Gemini (po aktywacji funkcji). Ustalić rejestr podmiotów przetwarzających i transfery poza EOG. Publiczny DNS nie identyfikuje pewnie rejestratora domeny; wymaga potwierdzenia w panelu właściciela.
4. Metadane obu istniejących D1 wskazują `jurisdiction: null` (TEST działa obecnie w `EEUR`, produkcja w `WEUR`). Cloudflare pozwala wybrać jurysdykcję tylko przy tworzeniu bazy; sam region działania nie dowodzi formalnego ograniczenia składowania do UE. Właściciel musi ocenić tę konfigurację i ewentualne transfery.
5. Zatwierdzić treść czterech wersji polityki prywatności; dopiero potem migracja, konfiguracja, backup i osobny Worker produkcyjny.

Źródła: [RODO](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [podatki.gov.pl](https://www.podatki.gov.pl/abc-podatkow/uprawnienia-i-obowiazki-podatnika/), [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Cloudflare D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/), [Cloudflare DPA](https://www.cloudflare.com/resources/assets/slt3lc6tev37/1M1j5uuFDuLTYiZJJDPBag/bca17eba6b088462dcd1ad928253f5c3/cloudflare-customer-dpa.pdf), [Stripe DPA](https://stripe.com/legal/dpa), [Gemini API Terms](https://ai.google.dev/gemini-api/terms), [GitHub privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
