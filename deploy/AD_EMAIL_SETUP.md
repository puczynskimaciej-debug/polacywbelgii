# Powiadomienia reklamowe przez OVHcloud MX Plan

Transport działa w Cloudflare Pages Functions przez SMTP z TLS na porcie 465. W TEST i PRODUKCJI ustaw osobno w **Settings → Variables and Secrets → Production**:

| Nazwa | Wartość |
| --- | --- |
| `AD_SMTP_HOST` | Dokładny serwer SMTP podany w panelu OVHcloud dla skrzynki MX Plan. |
| `AD_SMTP_USER` | `kontakt@polacywbelgii.eu` |
| `AD_SMTP_PASSWORD` | Hasło skrzynki lub dedykowane hasło SMTP; zapisz jako **Secret**. |

Nie umieszczaj hasła w pliku `.dev.vars`, Git ani w zgłoszeniu. Sprawdź w OVHcloud, czy dla tej skrzynki włączono wysyłkę SMTP. Po zapisaniu zmiennych przetestuj na TEST prośbę o poprawienie ogłoszenia i odbiór wiadomości na kontrolowanej skrzynce. Wysyłka potwierdzenia płatności na TEST wymaga osobnego zamówienia Sandbox. Nie testuj zwrotu na istniejącym zamówieniu produkcyjnym.

Prośba o poprawienie bez gotowego transportu zwraca błąd przed zmianą statusu. Jeśli SMTP zawiedzie po zapisaniu decyzji, CMS pokazuje komunikat o niewysłanym e-mailu; administrator może ponowić prośbę. Dla innych decyzji status pozostaje zapisany, a brak wysyłki jest widoczny w CMS.
