# Procedura przyszłego wydania produkcyjnego — bez wykonania

Ta procedura nie udziela zgody na wdrożenie. Produkcyjna D1, domena i Cron pozostają nietknięte do osobnego polecenia właściciela.

## 1. Bramka przed wydaniem

1. Uzyskać akceptację czterech polityk, potwierdzenie dostawców i ewidencję starszych backupów. Potwierdzić, kto obsługuje blokady spraw, incydentów i obowiązków prawnych.
2. Sprawdzić commit wydania, czysty Git, testy, skan sekretów oraz ostatni udany deployment TEST. Porównać D1 ID: TEST `76deb616-3e1d-4a64-9c68-7275336a91d4`, produkcja `be9435a1-b3ff-41dc-b70d-6f79f768d887`.
3. Odczytać w Cloudflare, czy stary projekt nadal ma `deployments_enabled=false`, `production_deployments_enabled=false`, `preview_deployment_setting=none`; TEST musi pozostać włączony.
4. Uruchomić `node scripts/check-pages-release-config.mjs`. Repozytoryjny `wrangler.toml` celuje w TEST. **Nie uruchamiać z niego produkcyjnego `pages deploy`.**

## 2. Kopia produkcyjnej D1

1. Odczytać identyfikator i schemat przez `npx wrangler d1 info polacywbelgii-preview` oraz zapytania `sqlite_master`/`PRAGMA table_info(contact_messages)` z `--remote --config wrangler.production.toml`. Nie kierować tych komend do TEST przez domyślny `wrangler.toml`.
2. Utworzyć nowy eksport `npx wrangler d1 export polacywbelgii-preview --remote --config wrangler.production.toml --output <prywatna-sciezka>.sql --skip-confirmation`. **Wrangler wypisuje w konsoli godzinny podpisany URL eksportu**; traktować log polecenia jak poufny i nie udostępniać go. Jeżeli wymagane jest niemieszczenie URL w dzienniku terminala, przekierować standardowe wyjście do prywatnego pliku i usunąć go po szyfrowaniu.
3. Zweryfikować, że plik jest niepusty, odtwarza się w izolowanym SQLite, zawiera `cms_users`, `ad_orders`, `ad_payment_events`, `contact_messages`, `cms_content` i nie ma błędów `PRAGMA foreign_key_check`. Nie wypisywać wierszy z danymi klientów.
4. Zaszyfrować `powershell -NoProfile -File scripts/protect-d1-backup.ps1 -InputPath <plik.sql> -OutputPath <plik.sql.dpapi> -Purpose 'production pre-migration' -RemovePlaintextAfterVerification`. Skrypt używa Windows DPAPI dla aktualnego użytkownika, ogranicza ACL, weryfikuje odszyfrowanie i SHA-256, zapisuje datę przeglądu po 30 dniach i usuwa nowy plik jawny dopiero po weryfikacji. **DPAPI CurrentUser wymaga tego samego konta Windows i komputera do odzyskania**; przy potrzebie kopii poza komputerem uzgodnić oddzielny, przenośny klucz przechowywany poza repozytorium.
5. Spisać cel, lokalizację, opiekuna, datę utworzenia i datę usunięcia. Po 30 dniach usunąć zaszyfrowany plik i manifest albo udokumentować konkretny obowiązek prawny przedłużający okres. Nie kasować starszych kopii bez inwentaryzacji wieku i celu.

[D1 Time Travel](https://developers.cloudflare.com/d1/platform/limits/) jest odrębny od ręcznego eksportu: 7 dni na Workers Free lub 30 dni na Paid. Plan konta trzeba potwierdzić. Przywrócenie punktu w czasie może cofnąć również poprawne nowe zapisy.

## 3. Migracje — tylko po backupie i osobnej zgodzie

Na produkcji potwierdzono tabele bazowego CMS, reklam, płatności oraz pięciu migracji AI. Przed działaniem sprawdzić to ponownie; nie wykonywać żadnego pliku bez analizy różnicy schematu. Oczekiwane brakujące pliki to, w tej kolejności:

1. `deploy/cloudflare-d1-0004-retention.sql` — dodaje `contact_messages.closed_at`, indeks i tabele retencji. Zawiera `ALTER TABLE`, więc **nie jest bezpieczny do ponownego wykonania** bez sprawdzenia `PRAGMA table_info`.
2. `deploy/cloudflare-d1-0005-security-log-holds.sql` — dodaje tabelę i indeks blokad logów.

Przed każdym plikiem potwierdzić w konsoli nazwę **`polacywbelgii-preview` oraz ID `be9435a1-b3ff-41dc-b70d-6f79f768d887`**. Użyć `npx wrangler d1 execute polacywbelgii-preview --remote --file <plik> --config wrangler.production.toml`. Po obu migracjach sprawdzić tabele, indeksy, sześć okresów w `retention_policy` (365/30/0/90/365; paid disabled), `PRAGMA foreign_key_check` oraz podstawowe odczyty bez treści osobowych. Produkcyjnego Workera i Crona **nie wdrażać**.

## 4. Kod — tylko po migracjach

1. Przygotować czysty, izolowany katalog z zatwierdzonego commita. W nim skopiować `wrangler.production.toml` jako `wrangler.toml` i uruchomić `node scripts/check-pages-release-config.mjs --active-production`. Komenda ma zakończyć się błędem w zwykłym katalogu repozytorium, który celuje w TEST. W razie błędu **przerwać**.
2. Zbudować z `CF_PAGES=1` i sprawdzić brak DEMO oraz wynik `_site`. Tuż przed deployem ponownie wykonać kontrolę aktywnej konfiguracji i odczyt bindingu produkcyjnego projektu Pages.
3. Dopiero po osobnej zgodzie właściciela użyć w izolowanym katalogu `npx wrangler pages deploy _site --project-name polacywbelgii --branch cloudflare-migration`. Zainstalowany Wrangler Pages nie ma opcji `--config` w `pages deploy`, dlatego podmiana **w izolowanym katalogu** jest konieczna. Nie zmieniać domyślnego pliku w gałęzi TEST.
4. Po deployu potwierdzić ID deploymentu, domenę, binding `DB`, cztery języki, stronę główną, kalendarz, formularz kontaktowy, CMS, reklamy i brak aktywnego Stripe/AI. Login administratora wymaga rzeczywistego aktualnego hasła. Produkcyjny Cron pozostawić wyłączony.

## 5. Awaria i cofanie

- Błąd migracji przed deployem: pozostawić stary kod publiczny, zachować diagnostykę, sprawdzić stan częściowo zastosowanego schematu. Nie uruchamiać pliku drugi raz w ciemno.
- Błąd nowego kodu przy poprawnej addytywnej migracji: wrócić do poprzedniego deploymentu Pages; stare funkcje powinny ignorować dodatkowe kolumny/tabele. Nie przywracać całej D1 bez potrzeby.
- Utrata lub uszkodzenie danych: zatrzymać nowe zapisy, wykonać eksport stanu do analizy i dopiero wtedy wybrać punkt Time Travel albo zweryfikowaną kopię. Przywrócenie starszej bazy usuwa zapisy dokonane po jej wykonaniu; wymagany jest plan odtworzenia tych zapisów z eksportu bieżącego i decyzja właściciela. Nie wykonywać destrukcyjnego restore automatycznie.
- Kopię DPAPI można sprawdzić lokalnie przez `powershell -NoProfile -File scripts/restore-d1-backup.ps1 -InputPath <plik.sql.dpapi> -OutputPath <nowa-prywatna-sciezka.sql>`. Skrypt weryfikuje manifest i hash przed utworzeniem pliku. Odtworzony jawny plik usunąć po zakończeniu testu; nie importuje nic do D1.
