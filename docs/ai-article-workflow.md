# Lokalny proces przygotowania artykułu

1. Zbadaj temat w źródłach pierwotnych. Zapisz dla każdej liczby rok, definicję i link. Sprawdź, czy nowsza edycja nie rewiduje poprzednich danych.
2. Napisz oryginalny tekst Markdown z metadanymi YAML zgodnymi z walidatorem `server/cms-content.js`. Opis SEO to pole `description`.
3. Zapisz szkic w `.local/drafts/<slug>.md`. Katalog `.local/` jest ignorowany przez Git i nie wchodzi do budowy Eleventy.
4. Uruchom `node scripts/preview-article-draft.js <slug>`. Skrypt sprawdza format tak jak CMS i tworzy `.local/preview/<slug>.html`. Otwórz ten plik lokalnie w przeglądarce.
5. Przed późniejszą publikacją ponownie sprawdź aktualność danych, źródła, tekst i linki. Dopiero po decyzji redakcyjnej przenieś plik do `src/content/articles/<slug>.md`; sam zapis przez CMS uruchamia proces publikacji. Zwróć uwagę na tłumaczenia, jeśli materiał ma być dostępny w innych językach.

Ten podgląd sprawdza treść i metadane w lokalnym HTML. Nie odwzorowuje całego szablonu strony. W obecnym CMS nie ma pola statusu `draft`, więc plik w katalogu artykułów zostałby uwzględniony w publicznej budowie.
