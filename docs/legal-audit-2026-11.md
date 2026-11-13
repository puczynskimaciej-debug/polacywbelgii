# Audyt projektów dokumentów — 11 listopada 2026

Dokumenty w `src/regulamin.md`, `src/regulamin-ogloszen.md`, `src/polityka-prywatnosci.md` i `src/polityka-cookies.md` są projektami opartymi na tekście dostarczonym przez właściciela. Mają znacznik `noindex` i informację o koniecznej weryfikacji. Nie są zatwierdzonymi warunkami świadczenia usług.

## Stwierdzone w kodzie

- Portal zapisuje preferencję języka w `localStorage` pod kluczem `siteLanguage`. CMS używa sesyjnego cookie ustawianego przez `/api/cms-auth`; kod formularza zamówień używa `sessionStorage` do powiązania zamówienia z powrotem ze Stripe Checkout.
- Integracja Stripe wymaga sesji `cs_test_` i odrzuca tryb produkcyjny. Rekord ogłoszenia przechowuje identyfikator transakcji, status płatności i dane zamówienia. Nie można twierdzić, że portal nie przetwarza żadnych danych związanych z płatnością.
- Agent Gemini przygotowuje materiały na podstawie źródeł; użycie klucza API jest po stronie serwera. Przed przyjęciem rzeczywistych danych osobowych do promptów trzeba ustalić i udokumentować przepływ danych.
- Kod źródłowy nie wykazuje obecnie integracji analityki ani zewnętrznych skryptów reklamowych. Zewnętrzne zasoby, w tym fonty Google, wymagają osobnej oceny w realnym środowisku.
- Kontury mapy pochodzą z Simplemaps Belgium GIS, które dla plików administracyjnych poziomu 1 wskazuje CC BY 4.0. Oznaczenie autora, link do źródła i licencji oraz informacja o zmianach są w `/zrodla-i-licencje/`.

## Przed zatwierdzeniem dokumentów

1. Potwierdzić operatora, dane adresowe, status VAT i właściwy proces fakturowania.
2. Zmapować wszystkie kategorie danych, cele, podstawy z art. 6 RODO, odbiorców, transfery poza EOG oraz okresy lub kryteria retencji. Uzupełnić politykę prywatności na podstawie rzeczywistej konfiguracji Cloudflare, poczty, Google i Stripe.
3. Przeprowadzić audyt cookies i magazynów przeglądarki w docelowej konfiguracji wraz z nazwami, dostawcami, celami i czasem życia. Włączyć mechanizm zgody, jeśli pojawią się technologie opcjonalne.
4. Zweryfikować prawniczo robocze wersje EN/NL/FR w `src/legal/`. Są redakcyjnymi przekładami skróconymi i nie mogą zastępować zatwierdzonych tłumaczeń dokumentów obowiązujących. Wersja polska pozostaje tekstem bazowym.
5. Potwierdzić zasady odstąpienia, pouczenie i wzór formularza przed sprzedażą konsumentom. Osobne żądanie wcześniejszego rozpoczęcia emisji jest przygotowane w formularzu, ale wymaga oceny prawnej i dopasowania do rzeczywistego terminu usługi.
6. Ustalić, czy portal kwalifikuje się jako dostawca usługi hostingu/platforma w rozumieniu DSA, oraz wdrożyć odpowiedni proces zgłoszenia, uzasadniania i odwołania od decyzji moderacyjnych.
7. Ustalić datę wejścia w życie i numer wersji regulaminu. Obecny identyfikator `draft-2026-11-11` oznacza wyłącznie projekt.

## Źródła do weryfikacji

- [Simplemaps Belgium GIS](https://simplemaps.com/gis/country/be)
- [Creative Commons BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [Komisja Europejska — prawo odstąpienia](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm)
- [Komisja Europejska — obowiązki informacyjne RODO](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en)
- [Komisja Europejska — DSA](https://digital-strategy.ec.europa.eu/en/faqs/digital-services-act-questions-and-answers)
- [Your Europe — cookies](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm)
