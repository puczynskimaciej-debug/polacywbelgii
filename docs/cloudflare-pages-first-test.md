# Pierwsze wdrożenie testowe Cloudflare Pages

Stan lokalny: 13 listopada 2026. Nie wykonano commita, pusha, wdrożenia ani operacji na zdalnej D1.

## Izolacja

- Nowy projekt Pages: `polacywbelgii-test`. Podłącz repozytorium `puczynskimaciej-debug/polacywbelgii` i wybierz `cloudflare-migration` jako gałąź produkcyjną **tego nowego projektu testowego**. Nie zmieniaj projektu `polacywbelgii`, jego gałęzi, domen ani bindingów.
- Build: `npm run build`; katalog wynikowy: `_site`; katalog główny repozytorium: `/`. Pages Functions są w `functions/`.
- `wrangler.toml` wskazuje wyłącznie projekt `polacywbelgii-test` i D1 `polacywbelgii-test` o ID `76deb616-3e1d-4a64-9c68-7275336a91d4`. Zarówno production, jak i preview **nowego projektu testowego** dziedziczą ten sam testowy binding `DB`.
- CMS ma `CMS_CONTENT_BACKEND=d1`. Adapter GitHub w Pages Functions uruchamia się tylko przy jawnym `CMS_CONTENT_BACKEND=github`; dla tego projektu nie ustawiaj `CMS_GITHUB_TOKEN`, `CMS_GITHUB_REPOSITORY` ani `CMS_GITHUB_BRANCH`.
- Kod Stripe przyjmuje wyłącznie `sk_test_`, `whsec_` i webhooki z `livemode=false`. `STRIPE_TEST_MODE=1` przygotowuje Sandbox, ale bez obu sekretów Checkout pozostaje niedostępny.
- AI ma `AI_AUTOMATION_ENABLED=0` i `GEMINI_FREE_TIER_CONFIRMED=0`. Nie dodawaj `GEMINI_API_KEY` ani `AGENT_SERVICE_TOKEN` na pierwszy test. Nie wdrażaj `workers/discovery.mjs`, `workers/publication.mjs` ani `workers/chat.mjs`: są oddzielnymi Workerami z własnymi plikami konfiguracyjnymi i harmonogramami, które nadal wskazują starą bazę preview. Samo Pages ich nie uruchamia.
- Workflow `.github/workflows/deploy.yml` uruchamia GitHub Pages tylko po pushu na `main`; gałąź `cloudflare-migration` go nie uruchomi.
- Lokalny `git origin` nadal zapisuje dawny adres `puczynskimaciej-debug/poradnik-polaka-w-belgii`; nie zmieniano go. W połączeniu GitHub w nowym projekcie Pages wybierz repozytorium wskazane przez właściciela: `puczynskimaciej-debug/polacywbelgii`. Przed przyszłym pushem osobno skoryguj lub sprawdź lokalny remote.
- Przed jakimkolwiek pushem sprawdź **odczytowo** w starym projekcie `polacywbelgii`, czy push na `cloudflare-migration` nie wywoła jego automatycznego wdrożenia preview. Jeżeli stary projekt śledzi tę gałąź, push zmieniłby stan starego projektu mimo osobnej konfiguracji Wrangler. Nie wykonuj wtedy pusha, dopóki nie ma metody wdrożenia bez dotykania starego projektu.

## Konfiguracja ręczna w panelu Cloudflare

W **Workers & Pages → Create application → Pages → Connect to Git** utwórz nowy projekt. Nazwa `polacywbelgii-test`, repozytorium i gałąź jak wyżej. Nie podłączaj domeny niestandardowej. Sprawdź, czy konfiguracja z `wrangler.toml` wskazuje `DB` na `polacywbelgii-test` i `CMS_CONTENT_BACKEND=d1`. Przy tym pliku Wrangler jest źródłem prawdy dla bindingu i jawnych zmiennych; nie ustawiaj w panelu sprzecznych wartości.

| Zmienna/binding | Środowisko nowego projektu | Ustawienie |
| --- | --- | --- |
| `DB` | Production i Preview | D1 `polacywbelgii-test`, ID `76deb616-3e1d-4a64-9c68-7275336a91d4`, z `wrangler.toml` |
| `CMS_CONTENT_BACKEND` | Production i Preview | `d1`, z `wrangler.toml` |
| `STRIPE_TEST_MODE` | Production i Preview | `1`, z `wrangler.toml`; Sandbox pozostaje nieaktywny bez sekretów |
| `AI_AUTOMATION_ENABLED`, `GEMINI_FREE_TIER_CONFIRMED` | Production i Preview | `0`, z `wrangler.toml` |
| `STRIPE_SECRET_KEY` | Tylko nowy projekt testowy | Opcjonalny zaszyfrowany sekret `sk_test_…`; nie dodawaj klucza Live |
| `STRIPE_WEBHOOK_SECRET` | Tylko nowy projekt testowy | Opcjonalny zaszyfrowany sekret testowego endpointu `whsec_…` |
| `CMS_ORIGIN` | Nowy projekt testowy | Pozostaw nieustawione; kod sprawdza origin bieżącego adresu Pages |
| `CMS_GITHUB_TOKEN`, `GEMINI_API_KEY`, `AGENT_SERVICE_TOKEN` | Nowy projekt testowy | Nie ustawiaj na pierwszy test |

Sekrety Stripe dodaj dopiero przy osobnym teście Sandbox w **Settings → Variables and Secrets** nowego projektu, jako zaszyfrowane. Webhook: `https://polacywbelgii-test.pages.dev/api/ads-payment?action=webhook` (po potwierdzeniu faktycznego adresu projektu). Zdarzenia: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Żadne dane testowe nie powinny trafiać do Stripe Live.

## Migracje nowej D1

Pusta baza wymaga **ośmiu istniejących plików SQL**, w tej kolejności:

1. `deploy/cloudflare-d1.sql` — CMS użytkownicy/sesje, reklamy, ustawienia i limity.
2. `deploy/cloudflare-d1-0002.sql` — wersje zapisów reklam i wiadomości kontaktowe.
3. `deploy/cloudflare-d1-0003-stripe.sql` — zdarzenia i historia płatności/reklam.
4. `agent/migrations/001_agent.sql` — źródła, kandydaci, historia, konfiguracja AI.
5. `agent/migrations/002_editorial.sql` — kolejka moderacji i publikacji; zapisuje domyślną konfigurację redakcyjną, lecz nie uruchamia crona.
6. `agent/migrations/003_content.sql` — treści CMS, artykuły, obrazy i historia.
7. `agent/migrations/004_discovery.sql` — zadania odkrywania i budżet AI; dodaje źródła, lecz przy wyłączonej automatyzacji nie uruchamia agenta.
8. `agent/migrations/005_chat.sql` — kolejka czatu AI.

Przed przyszłą migracją zdalną sprawdź **odczytowo** w Cloudflare, że baza o tej nazwie ma dokładnie ID `76deb616-3e1d-4a64-9c68-7275336a91d4` i jest pusta. Każdy plik stosuj wyłącznie do `polacywbelgii-test`, bez używania `DB` jako niejednoznacznego celu. Nie importuj demonstracyjnych reklam jako danych klientów. Po migracji potrzebne będzie osobne konto administratora testowej D1; lokalne konto i hasło nie przenoszą się automatycznie.

Pierwszy test po uruchomieniu: `GET /api/health` powinien zwrócić `ready: true`; następnie sprawdź `/admin/`, zapis szkicu, listę artykułów/wydarzeń i reklamy. Bez schematu D1 health zwróci 503. Żadna z powyższych czynności zdalnych nie została wykonana w ramach tego przygotowania.
