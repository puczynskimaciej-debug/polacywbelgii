# Powiadomienia reklamowe przez OVHcloud MX Plan

Transport używa Cloudflare Pages Functions i SMTP z TLS na porcie 465. Dla PRODUKCJI serwer i użytkownik są zapisani w `wrangler.production.toml`. W panelu **polacywbelgii → Settings → Variables and Secrets → Production** właściciel zapisuje tylko `AD_SMTP_PASSWORD` jako **Secret**.

| Nazwa | Wartość |
| --- | --- |
| `AD_SMTP_HOST` | `ssl0.ovh.net` (w produkcyjnym pliku Wrangler). |
| `AD_SMTP_USER` | `kontakt@polacywbelgii.eu` (w produkcyjnym pliku Wrangler). |
| `AD_SMTP_PASSWORD` | Hasło skrzynki lub dedykowane hasło SMTP; zapisz jako **Secret**. |

Nie umieszczaj hasła w pliku `.dev.vars`, Git ani w zgłoszeniu. Sprawdź w OVHcloud, czy dla tej skrzynki włączono wysyłkę SMTP. Do potwierdzenia dostarczania wiadomości potrzebne jest ustawienie sekretu i kontrolowana wiadomość na skrzynkę właściciela. Nie testuj zwrotu na istniejącym zamówieniu produkcyjnym.

Parametry serwera wynikają z [dokumentacji MX Plan OVHcloud](https://docs.ovhcloud.com/en/guides/web-cloud/email-and-collaborative-solutions/mx-plan/email-generalities) i istniejącej konfiguracji DNS portalu. Cloudflare opisuje `cloudflare:sockets`, TLS `on` i ograniczenie portu 25 w [dokumentacji Workers](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/). Rzeczywistego połączenia SMTP i dostarczenia wiadomości nie można potwierdzić bez sekretu skrzynki.

Prośba o poprawienie bez gotowego transportu zwraca błąd przed zmianą statusu. Jeśli SMTP zawiedzie po zapisaniu decyzji, CMS pokazuje komunikat o niewysłanym e-mailu; administrator może ponowić prośbę. Dla innych decyzji status pozostaje zapisany, a brak wysyłki jest widoczny w CMS.
