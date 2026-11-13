# Lokalne logowanie do CMS

`npm run dev` buduje stronę i uruchamia Cloudflare Pages z lokalną D1 na `http://localhost:8080/admin/`. Backend CMS wymaga Wrangler Pages; samo `npm run dev:static` uruchamia wyłącznie statyczny serwer Eleventy i nie obsługuje `/api/cms-auth`. Dotychczasowy `npm run local:pages` nadal udostępnia ten sam backend i tę samą D1 na porcie 8791.

Lokalne konto `kontakt@polacywbelgii.eu` ma rolę `admin`. Hasło jest zahashowane przez istniejący moduł `cloudflare/auth.mjs`. Aktualne hasło lokalne znajduje się w pliku `%LOCALAPPDATA%\PolacywBelgii\local-cms-admin-password.txt`, poza repozytorium. W PowerShell można je odczytać poleceniem:

```powershell
Get-Content (Join-Path $env:LOCALAPPDATA 'PolacywBelgii\local-cms-admin-password.txt')
```

Po zalogowaniu można zmienić je w panelu przez „Zmień hasło”. W razie potrzeby `npm run local:admin:reset` generuje nowe silne hasło i resetuje wyłącznie to konto w lokalnej D1. Skrypt unieważnia stare sesje i wymaga zmiany hasła przy następnym logowaniu. Nie dotyka produkcyjnej bazy.

Konto jest przechowywane w `.local/wrangler/`, więc restart `npm run dev` go nie usuwa. Usunięcie tego katalogu skasowałoby lokalne konto.

Kolejka AI, kalendarz, reklamy i zamówienia korzystają z lokalnej D1. Edycja zwykłych artykułów w tym CMS nadal wymaga osobnej konfiguracji magazynu treści (`CMS_GITHUB_TOKEN`); bez niej API `/api/cms-content` zwraca `contentConfiguration` (503). Sama rola administratora zapewnia dostęp do zakładki i uprawnienia, ale nie konfiguruje tego magazynu.
