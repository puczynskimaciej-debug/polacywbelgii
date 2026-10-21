# Cloudflare Pages migration: stan na 2026-10-21

## Odzysk danych bez opłat Netlify

- GitHub: gałęzie `main`, `feature/paid-ads-password-cms` i `cloudflare-migration` zawierają treści statyczne, trzy artykuły Markdown, ustawienia strony i migracje z 36 demonstracyjnymi zamówieniami (plus 12 angielskich). To nie jest dowód kompletności danych produkcyjnych.
- Lokalny `.local/ad_orders_export.json` zawiera 36 zatwierdzonych zamówień z 2026-09-29. Wszystkie ID znajdują się w migracji demonstracyjnej. `.local/production-ads.json` zawiera 12 publicznych reklam z 2026-10-20; każde ID również występuje w tej migracji. Drugi plik nie zawiera pełnych danych zamówień ani grafik. `.local/demo-ads.json` to oddzielne dane testowe.
- Lokalne `.netlify/db` i `.local/preview-postgres` są bazami developerskimi. Nie ma dowodu, że są kopią produkcji. W katalogu projektu i typowych katalogach użytkownika nie znaleziono innego pełnego eksportu.
- Odczyt bazy Netlify `production` zwrócił HTTP 423 `database is disabled`; bezpośrednia próba odczytu przez istniejący klient zakończyła się odmową autoryzacji. Baza może nadal zawierać dodatkowe zamówienia, konta i ustawienia. Nie była włączana ani modyfikowana.
- API Netlify wskazało snapshoty `snap-silent-sea-b5e5lwy9` (2026-10-21 07:23 UTC) i `snap-square-shadow-b5xduymb` (2026-10-20 22:02 UTC). Dostępne API nie udostępnia pobrania snapshotu; przywrócenie nadpisywałoby źródło. Nie wykonano takiej operacji.

Wniosek: istnieją darmowe kopie części treści, lecz kompletności zamówień i kont CMS nie można potwierdzić. Nie importować seedów jako odzyskanej produkcji.

## Kod Cloudflare przygotowany lokalnie

- `wrangler.toml` wiąże `DB` z bazą D1 `be9435a1-b3ff-41dc-b70d-6f79f768d887`, buduje `_site` i wskazuje gałąź CMS `cloudflare-migration`. Sekrety nie są w repo.
- `functions/api` obsługuje reklamy, rezerwacje, CMS email/hasło, treści CMS, kontakt i stan usługi. Logika reklam korzysta z dotychczasowych reguł domenowych. Netlify i domena produkcyjna pozostają bez zmian.
- `deploy/cloudflare-d1.sql` to pierwsze siedem tabel, które użytkownik już wykonał w D1. `deploy/cloudflare-d1-0002.sql` dodaje dziennik wersji zapisów reklam oraz wiadomości kontaktowe; wymaga jeszcze wykonania w zdalnym D1.
- Dotychczasowe hashe scrypt przekraczają praktyczny limit pamięci Workers. Nowe logowanie zachowuje email/hasło i używa PBKDF2-SHA256. Konta wymagają jednorazowego ustawienia nowych haseł; użytkownik to zaakceptował. Nie przenosić aktywnych sesji. `scripts/cloudflare-bootstrap-admin.mjs` przygotowuje jednorazowy INSERT administratora tylko dla pustej tabeli użytkowników.
- `scripts/cloudflare-export.js` tworzy spójny, wyłącznie odczytowy snapshot PostgreSQL, gdy dostęp do Netlify kiedyś wróci. `scripts/cloudflare-import.js` jest domyślnie podglądem; `--apply` wyłącznie dodaje brakujące wiersze, zachowuje istniejące D1 i zgłasza konflikty. Snapshot pozostaje lokalny i ignorowany przez Git. Nie przeprowadzać importu bez przeglądu podglądu i kopii D1.

## Kroki przed uruchomieniem na pages.dev

1. Wykonać `deploy/cloudflare-d1-0002.sql` w zdalnym D1. Nie zawiera DROP/DELETE i nie usuwa żadnych rekordów.
2. Ustawić sekret `CMS_GITHUB_TOKEN` w projekcie Pages, z dostępem do zapisu treści repo, oraz sprawdzić powiązanie `DB`. Ustawić `CONTEXT=production`, aby nie publikować danych z `.local`.
3. Utworzyć pierwszego administratora albo zaplanować reset istniejących kont po późniejszym imporcie. Żadne hasło nie jest zapisane w repo.
4. Wdrożyć gałąź `cloudflare-migration` na pages.dev i sprawdzić przepływy w środowisku Workers. Limit CPU darmowego planu może uniemożliwić bezpieczne hashowanie PBKDF2 600 tys. iteracji; zweryfikować przed obietnicą pełnego logowania. Nie uruchamiać płatnego planu bez zgody użytkownika.
5. Po odzyskaniu dostępu do Netlify wykonać odczytowy eksport, porównać liczniki i ID, uruchomić podgląd importu, rozwiązać konflikty, a dopiero potem import. Nie przełączać domeny ani wyłączać Netlify w tym etapie.

Lokalnie: `node scripts/check-cloudflare-schema.js`, `npx wrangler pages functions build`, `npm run build`, `node --test tests/cloudflare.test.mjs`. Testy lokalne nie dowodzą konfiguracji sekretów ani wydajności hashowania w produkcyjnym Workers.
