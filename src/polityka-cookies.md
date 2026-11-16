---
layout: legal.njk
title: Polityka cookies
description: Polityka cookies PolacywBelgii.eu.
pageKey: legal
legalKey: legal.cookies
permalink: /polityka-cookies/index.html
---

## Zapis w przeglądarce

Na publicznej stronie przy pierwszym wejściu nie zapisujemy cookies ani danych w localStorage. Nie używamy narzędzi analitycznych, pikseli reklamowych ani zewnętrznych czcionek. Nie wyświetlamy banera zgód, ponieważ w obecnej wersji nie uruchamiamy opcjonalnych technologii śledzących.

| Mechanizm | Kiedy i po co | Czas i dostęp |
| --- | --- | --- |
| `siteLanguage` (sessionStorage) | Po wybraniu języka: zachowanie wybranego języka podczas przeglądania. | Do zamknięcia karty; tylko skrypty tej witryny. |
| `pbe-order-{id}` (sessionStorage) | Po złożeniu zamówienia: powrót do statusu zamówienia po przejściu do płatności. | Do zamknięcia karty; tylko skrypty tej witryny. |
| `__Host-pbe_session` (cookie) | Po zalogowaniu administratora: uwierzytelnienie CMS. HttpOnly, Secure, SameSite=Strict. | Maksymalnie 8 godzin; wysyłane do serwera tej witryny. |
| `ai-chat-conversation` (sessionStorage) | Po użyciu czatu AI przez administratora: wskazanie bieżącej rozmowy. | Do zamknięcia karty; tylko skrypty CMS. |

Te mechanizmy służą funkcjom, o które użytkownik prosi: wyborowi języka, obsłudze zamówienia i bezpiecznej sesji administratora. Nie służą profilowaniu ani reklamie behawioralnej. Przeglądarka pozwala usuwać dane witryny; wylogowanie kończy sesję CMS.

Po uruchomieniu płatności użytkownik świadomie przechodzi do Stripe, który może stosować własne technologie na swojej stronie. Jeśli w przyszłości zostaną włączone usługi analityczne, marketingowe lub inne opcjonalne mechanizmy, polityka i sposób uzyskania zgody będą wymagały aktualizacji przed ich uruchomieniem. Dostawca hostingu Cloudflare może warunkowo stosować środki bezpieczeństwa zależnie od konfiguracji; ich rzeczywiste występowanie należy ponownie sprawdzić po zmianie ustawień.

Pytania: kontakt@polacywbelgii.eu. [Polityka prywatności](/polityka-prywatnosci/).
