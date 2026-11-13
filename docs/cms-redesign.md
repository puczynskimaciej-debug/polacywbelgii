# CMS: nowy interfejs lokalny

Panel działa pod `http://localhost:8080/admin/` po `npm run dev`. Istniejąca aplikacja pozostaje w czystym JavaScript, HTML i CSS. `admin-app/ai-editor-redesign.js` obsługuje kolejkę, szczegóły, edycję, decyzje i kalendarz; `admin-app/ui.js` zawiera wspólne dialogi i bezpieczny podgląd Markdown; `admin-app/redesign.css` nadaje spójny układ oraz widoki mobilne. Backend, zasady moderacji, Stripe i publiczny portal nie były zmieniane przez redesign.

W lokalnym środowisku bez `CMS_GITHUB_TOKEN` magazyn zwykłych artykułów, mediów, strony głównej i historii GitHub jest niedostępny. Panel pokazuje wyraźny komunikat. Materiały AI, kalendarz, reklamy, zamówienia i użytkownicy nadal działają na lokalnej D1.

Sprawdzenie interfejsu: `node scripts/check-cms-redesign.mjs` otwiera wszystkie sekcje w przeglądarce przy szerokościach 1440, 1024, 768 i 390 px. `node scripts/check-cms-redesign-actions.mjs` sprawdza akceptację, harmonogram, zmianę czasu i potwierdzenie odrzucenia na tymczasowym materiale. Oba skrypty tworzą i usuwają wyłącznie własne testowe rekordy w lokalnej D1. `npm run test:editorial:e2e` sprawdza pełny obieg z lokalnym publikowaniem i jest ograniczony do własnego materiału testowego.
