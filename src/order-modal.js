(() => {
  const copy = {
    pl: {
      title: 'Zamów ogłoszenie', intro: 'Wybierz języki, miejsce, format i termin. Dostępność oraz cenę sprawdzisz przed wysłaniem.',
      languages: '1. Języki ogłoszenia', placement: '2. Miejsce publikacji', top: 'TOP — wyróżnione ogłoszenia', standard: 'STANDARD — sekcja ogłoszeń', premium: 'PREMIUM — baner na samej górze strony',
      format: '3. Format reklamy', text: 'Ogłoszenie tekstowe', banner: 'Baner graficzny', dates: '4. Termin publikacji',
      hint: 'Wybierz pierwszy i ostatni dzień w kalendarzu lub użyj pól daty. Szare dni są zajęte. Maksymalnie 90 kolejnych dni.',
      from: 'Od', to: 'Do (włącznie)', pickEnd: 'Wybierz ostatni dzień', free: 'wolne',
      textContent: '5. Treść ogłoszenia', bannerContent: '5. Treść banera', textPrompt: 'Treść ogłoszenia', bannerTitle: 'Tytuł', bannerDescription: 'Krótki opis',
      company: 'Firma / reklamodawca', url: 'Adres strony reklamy', image: 'Baner (PNG, JPEG lub WebP, do 500 KB)', customer: 'Imię i nazwisko zamawiającego',
      contact: 'Kontakt widoczny pod ogłoszeniem', contactHint: 'Telefon, e-mail lub adres — wpisz tylko to, co chcesz upublicznić.',
      email: 'Twój e-mail — tylko dla administratorów', privacy: 'Ten adres służy do obsługi zamówienia i nie pojawi się w ogłoszeniu.',
      consent: 'Zgadzam się na publikację podanej treści i publicznych danych reklamodawcy.', terms: 'Akceptuję projekt regulaminu płatnych ogłoszeń', earlyService: 'Wyraźnie żądam rozpoczęcia emisji przed upływem terminu odstąpienia (jeżeli dotyczy).', total: 'Łącznie', days: 'Wybrane dni',
      review: 'Sprawdź zamówienie', send: 'Złóż zamówienie', back: 'Wróć do edycji', close: 'Zamknij', loading: 'Sprawdzanie dostępności…',
      unavailable: 'Zamawianie w wybranym języku jest obecnie wyłączone.', error: 'Nie udało się pobrać danych. Spróbuj ponownie.',
      full: 'Wybrany termin obejmuje zajęte dni. Wybierz inny zakres.', changed: 'Cena zmieniła się. Sprawdź nową cenę.',
      imageError: 'Wybierz plik PNG, JPEG lub WebP do 500 KB.', success: 'Zamówienie zapisane i czeka na akceptację redakcji.',
      unpaid: 'Płatności online nie są jeszcze dostępne. Teraz nic nie płacisz.', payNote: 'Po złożeniu zamówienia przejdziesz do bezpiecznej płatności Stripe. Reklama pojawi się po potwierdzeniu płatności i akceptacji redakcji.', pay: 'Przejdź do płatności', paymentDisabled: 'Płatności online są chwilowo niedostępne. Zamówienie nie zostanie wysłane.', paymentReturnUntracked: 'Dziękujemy za powrót ze Stripe. Status płatności potwierdza webhook. Numer zamówienia:', empty: 'Wybierz dostępny zakres dat.',
      previous: 'Poprzedni miesiąc', next: 'Następny miesiąc', limit: 'Możesz wybrać maksymalnie 90 kolejnych dni.',
      demoNotice: 'Tryb demonstracyjny — ceny i dostępność są przykładowe. Nic nie zostanie zapisane.', demoSuccess: 'To był podgląd zamówienia. Nic nie zostało wysłane.'
    },
    en: {
      title: 'Order a listing', intro: 'Choose languages, placement, format and dates. Check availability and price before submitting.',
      languages: '1. Listing languages', placement: '2. Placement', top: 'TOP — featured listings', standard: 'STANDARD — listings section', premium: 'PREMIUM — banner at the very top of the page',
      format: '3. Ad format', text: 'Text listing', banner: 'Image banner', dates: '4. Publication dates',
      hint: 'Choose the first and last day in the calendar or use the date fields. Grey days are fully booked. Up to 90 consecutive days.',
      from: 'From', to: 'To (inclusive)', pickEnd: 'Choose the last day', free: 'free',
      textContent: '5. Listing text', bannerContent: '5. Banner content', textPrompt: 'Listing text', bannerTitle: 'Title', bannerDescription: 'Short description',
      company: 'Company / advertiser', url: 'Advertiser website', image: 'Banner (PNG, JPEG or WebP, up to 500 KB)', customer: 'Customer name',
      contact: 'Contact details shown with the listing', contactHint: 'Phone, email or address — enter only what you want to make public.',
      email: 'Your email — visible to administrators only', privacy: 'This address is used to handle your order and is not shown in the listing.',
      consent: 'I agree to publication of the content and public advertiser details I provided.', terms: 'I accept the draft paid listings terms', earlyService: 'I expressly request that the listing start before the withdrawal period ends (if applicable).', total: 'Total', days: 'Selected days',
      review: 'Review order', send: 'Submit order', back: 'Back to editing', close: 'Close', loading: 'Checking availability…',
      unavailable: 'Orders are currently disabled for the chosen language.', error: 'Could not load the data. Please try again.',
      full: 'The chosen range contains fully booked days. Choose another range.', changed: 'The price changed. Review the new total.',
      imageError: 'Choose a PNG, JPEG or WebP file up to 500 KB.', success: 'Your order was saved and is awaiting editorial approval.',
      unpaid: 'Online payments are not available yet. You do not pay anything now.', payNote: 'After submitting your order, you will proceed to secure Stripe payment. The listing will appear after payment confirmation and editorial approval.', pay: 'Proceed to payment', paymentDisabled: 'Online payments are temporarily unavailable. Your order will not be submitted.', paymentReturnUntracked: 'Thank you for returning from Stripe. The webhook confirms payment status. Order number:', empty: 'Choose an available date range.',
      previous: 'Previous month', next: 'Next month', limit: 'You can select up to 90 consecutive days.',
      demoNotice: 'Demo mode — prices and availability are examples. Nothing will be saved.', demoSuccess: 'This was an order preview. Nothing was submitted.'
    },
    nl: {
      title: 'Plaats een advertentie', intro: 'Kies talen, plaatsing, formaat en periode. Bekijk de beschikbaarheid en prijs voor verzending.',
      languages: '1. Talen van de advertentie', placement: '2. Plaatsing', top: 'TOP — uitgelichte advertenties', standard: 'STANDARD — advertentierubriek', premium: 'PREMIUM — banner helemaal bovenaan de pagina',
      format: '3. Advertentieformaat', text: 'Tekstadvertentie', banner: 'Afbeeldingsbanner', dates: '4. Publicatieperiode',
      hint: 'Kies de eerste en laatste dag in de kalender of gebruik de datumvelden. Grijze dagen zijn volzet. Maximaal 90 opeenvolgende dagen.',
      from: 'Van', to: 'Tot en met', pickEnd: 'Kies de laatste dag', free: 'vrij',
      textContent: '5. Advertentietekst', bannerContent: '5. Bannerinhoud', textPrompt: 'Advertentietekst', bannerTitle: 'Titel', bannerDescription: 'Korte beschrijving',
      company: 'Bedrijf / adverteerder', url: 'Website van de adverteerder', image: 'Banner (PNG, JPEG of WebP, maximaal 500 KB)', customer: 'Naam van de klant',
      contact: 'Contactgegevens bij de advertentie', contactHint: 'Telefoon, e-mail of adres — vul alleen in wat openbaar mag zijn.',
      email: 'Je e-mail — alleen voor beheerders', privacy: 'Dit adres wordt gebruikt voor je bestelling en niet getoond in de advertentie.',
      consent: 'Ik stem in met publicatie van de opgegeven inhoud en openbare adverteerdersgegevens.', terms: 'Ik aanvaard het ontwerpreglement voor betaalde advertenties', earlyService: 'Ik verzoek uitdrukkelijk om de advertentie vóór het einde van de herroepingstermijn te starten (indien van toepassing).', total: 'Totaal', days: 'Geselecteerde dagen',
      review: 'Controleer bestelling', send: 'Bestelling plaatsen', back: 'Terug naar bewerken', close: 'Sluiten', loading: 'Beschikbaarheid controleren…',
      unavailable: 'Bestellen is momenteel uitgeschakeld voor de gekozen taal.', error: 'Gegevens laden mislukt. Probeer opnieuw.',
      full: 'De gekozen periode bevat volzette dagen. Kies een andere periode.', changed: 'De prijs is gewijzigd. Controleer het nieuwe bedrag.',
      imageError: 'Kies een PNG-, JPEG- of WebP-bestand van maximaal 500 KB.', success: 'De bestelling is opgeslagen en wacht op goedkeuring.',
      unpaid: 'Online betalen is nog niet beschikbaar. Je betaalt nu niets.', payNote: 'Na het plaatsen van je bestelling ga je naar de beveiligde betaling via Stripe. De advertentie verschijnt na bevestiging van de betaling en goedkeuring door de redactie.', pay: 'Ga naar de betaling', paymentDisabled: 'Online betalen is tijdelijk niet beschikbaar. Je bestelling wordt niet verzonden.', paymentReturnUntracked: 'Bedankt voor je terugkeer van Stripe. De webhook bevestigt de betaalstatus. Bestelnummer:', empty: 'Kies een beschikbare periode.',
      previous: 'Vorige maand', next: 'Volgende maand', limit: 'Je kunt maximaal 90 opeenvolgende dagen kiezen.',
      demoNotice: 'Demomodus — prijzen en beschikbaarheid zijn voorbeelden. Er wordt niets opgeslagen.', demoSuccess: 'Dit was een voorbeeld. Er is niets verzonden.'
    },
    fr: {
      title: 'Publier une annonce', intro: 'Choisissez les langues, l’emplacement, le format et la période. Vérifiez la disponibilité et le prix avant l’envoi.',
      languages: '1. Langues de l’annonce', placement: '2. Emplacement', top: 'TOP — annonces mises en avant', standard: 'STANDARD — rubrique annonces', premium: 'PREMIUM — bannière tout en haut de la page',
      format: '3. Format de l’annonce', text: 'Annonce textuelle', banner: 'Bannière illustrée', dates: '4. Période de publication',
      hint: 'Choisissez le premier et le dernier jour dans le calendrier ou utilisez les champs de date. Les jours gris sont complets. 90 jours consécutifs maximum.',
      from: 'Du', to: 'Au (inclus)', pickEnd: 'Choisissez le dernier jour', free: 'libres',
      textContent: '5. Texte de l’annonce', bannerContent: '5. Contenu de la bannière', textPrompt: 'Texte de l’annonce', bannerTitle: 'Titre', bannerDescription: 'Brève description',
      company: 'Entreprise / annonceur', url: 'Site de l’annonceur', image: 'Bannière (PNG, JPEG ou WebP, 500 Ko maximum)', customer: 'Nom du client',
      contact: 'Coordonnées affichées avec l’annonce', contactHint: 'Téléphone, e-mail ou adresse — indiquez uniquement ce qui peut être public.',
      email: 'Votre e-mail — réservé aux administrateurs', privacy: 'Cette adresse sert à gérer la commande et n’apparaît pas dans l’annonce.',
      consent: 'J’accepte la publication du contenu et des coordonnées publiques de l’annonceur fournis.', terms: 'J’accepte le projet de conditions des annonces payantes', earlyService: 'Je demande expressément le début de la diffusion avant la fin du délai de rétractation (le cas échéant).', total: 'Total', days: 'Jours sélectionnés',
      review: 'Vérifier la commande', send: 'Envoyer la commande', back: 'Retour à la modification', close: 'Fermer', loading: 'Vérification des disponibilités…',
      unavailable: 'Les commandes sont actuellement désactivées pour la langue choisie.', error: 'Impossible de charger les données. Réessayez.',
      full: 'La période choisie contient des jours complets. Choisissez une autre période.', changed: 'Le prix a changé. Vérifiez le nouveau montant.',
      imageError: 'Choisissez un fichier PNG, JPEG ou WebP de 500 Ko maximum.', success: 'La commande a été enregistrée et attend la validation de la rédaction.',
      unpaid: 'Le paiement en ligne n’est pas encore disponible. Vous ne payez rien maintenant.', payNote: 'Après l’envoi de votre commande, vous passerez au paiement sécurisé Stripe. L’annonce paraîtra après confirmation du paiement et validation par la rédaction.', pay: 'Passer au paiement', paymentDisabled: 'Le paiement en ligne est temporairement indisponible. Votre commande ne sera pas envoyée.', paymentReturnUntracked: 'Merci de votre retour de Stripe. Le webhook confirme le statut du paiement. Numéro de commande :', empty: 'Choisissez une période disponible.',
      previous: 'Mois précédent', next: 'Mois suivant', limit: 'Vous pouvez choisir 90 jours consécutifs au maximum.',
      demoNotice: 'Mode démonstration — prix et disponibilités fictifs. Rien ne sera enregistré.', demoSuccess: 'Ceci était un aperçu. Rien n’a été envoyé.'
    }
  };

  Object.assign(copy.pl, { privacyNotice:'Dane zamówienia przetwarzamy, aby przygotować i obsłużyć ogłoszenie. Dane kontaktowe wskazane jako publiczne pojawią się przy reklamie.', privacyPolicy:'Polityka prywatności' });
  Object.assign(copy.en, { privacyNotice:'We process order details to prepare and manage your listing. Contact details marked public will appear with the ad.', privacyPolicy:'Privacy policy' });
  Object.assign(copy.nl, { privacyNotice:'Wij verwerken bestelgegevens om uw advertentie voor te bereiden en te beheren. Als openbaar opgegeven contactgegevens verschijnen bij de advertentie.', privacyPolicy:'Privacybeleid' });
  Object.assign(copy.fr, { privacyNotice:'Nous traitons les données de commande pour préparer et gérer votre annonce. Les coordonnées indiquées comme publiques apparaîtront avec l’annonce.', privacyPolicy:'Politique de confidentialité' });

  Object.assign(copy.pl, { topImage: 'Grafika TOP: 1200 × 720 px (PNG, JPEG lub WebP, do 500 KB).', premiumImage: 'Grafika PREMIUM: komputer 1200 × 200 px i telefon 660 × 300 px. Każdy plik PNG, JPEG lub WebP, do 500 KB.', mobileImage: 'Grafika na telefon (660 × 300 px)', dimensionError: 'Grafika ma inne wymiary niż wymagane dla wybranego miejsca publikacji.' });
  Object.assign(copy.en, { topImage: 'TOP image: 1200 × 720 px (PNG, JPEG or WebP, up to 500 KB).', premiumImage: 'PREMIUM images: desktop 1200 × 200 px and mobile 660 × 300 px. Each PNG, JPEG or WebP, up to 500 KB.', mobileImage: 'Mobile image (660 × 300 px)', dimensionError: 'The image dimensions do not match the selected placement.' });
  Object.assign(copy.nl, { topImage: 'TOP-afbeelding: 1200 × 720 px (PNG, JPEG of WebP, maximaal 500 KB).', premiumImage: 'PREMIUM-afbeeldingen: desktop 1200 × 200 px en mobiel 660 × 300 px. Elk PNG, JPEG of WebP, maximaal 500 KB.', mobileImage: 'Mobiele afbeelding (660 × 300 px)', dimensionError: 'De afbeelding heeft niet de vereiste afmetingen voor deze plaatsing.' });
  Object.assign(copy.fr, { topImage: 'Image TOP : 1200 × 720 px (PNG, JPEG ou WebP, 500 Ko maximum).', premiumImage: 'Images PREMIUM : ordinateur 1200 × 200 px et mobile 660 × 300 px. Chaque fichier PNG, JPEG ou WebP, 500 Ko maximum.', mobileImage: 'Image mobile (660 × 300 px)', dimensionError: 'Les dimensions de l’image ne correspondent pas à cet emplacement.' });
  Object.assign(copy.pl, { baseLanguage: 'Język podstawowy', extraLanguages: 'Dodatkowe języki (50%)', plannedStart: 'Planowany początek', plannedEnd: 'Planowany koniec', brusselsTime: 'czas belgijski', todayTiming: 'Emisja rozpocznie się po potwierdzeniu płatności i zatwierdzeniu ogłoszenia. Otrzymasz pełną liczbę wykupionych godzin od faktycznego rozpoczęcia emisji.', numberOfDays: 'Liczba dni emisji' });
  Object.assign(copy.en, { baseLanguage: 'Primary language', extraLanguages: 'Extra languages (50%)', plannedStart: 'Planned start', plannedEnd: 'Planned end', brusselsTime: 'Belgian time', todayTiming: 'The listing starts after confirmed payment and approval. You receive the full purchased number of hours from its actual start.', numberOfDays: 'Number of days' });
  Object.assign(copy.nl, { baseLanguage: 'Hoofdtaal', extraLanguages: 'Extra talen (50%)', plannedStart: 'Geplande start', plannedEnd: 'Gepland einde', brusselsTime: 'Belgische tijd', todayTiming: 'De advertentie start na bevestiging van betaling en goedkeuring. U krijgt alle gekochte uren vanaf de werkelijke start.', numberOfDays: 'Aantal dagen' });
  Object.assign(copy.fr, { baseLanguage: 'Langue principale', extraLanguages: 'Langues supplémentaires (50 %)', plannedStart: 'Début prévu', plannedEnd: 'Fin prévue', brusselsTime: 'heure belge', todayTiming: 'La diffusion commence après confirmation du paiement et validation. Vous bénéficiez de toutes les heures achetées dès le début effectif.', numberOfDays: 'Nombre de jours' });
  Object.assign(copy.pl, { hint:'Kliknij dowolne dni, również niekolejne. Ponowne kliknięcie usuwa dzień. Maksymalnie 90 dni.', selectedCount:'Wybrano', hours:'godzin emisji', removeDate:'Usuń dzień', available:'Dostępne', fullLanguage:'Brak miejsc', conflict:'Wybrane dni mają konflikt dostępności', limit:'Możesz wybrać maksymalnie 90 dni.', region:'Zasięg ogłoszenia', preview:'Podgląd ogłoszenia', desktop:'Komputer', mobile:'Telefon', autoImage:'Grafika zostanie automatycznie dopasowana bez obcinania i deformacji.', imageWarning:'Jeśli grafika zawiera drobny tekst, sprawdź jego czytelność w podglądzie mobilnym.' });
  Object.assign(copy.en, { hint:'Select any days, including nonconsecutive ones. Click again to remove. Up to 90 days.', selectedCount:'Selected', hours:'hours of display', removeDate:'Remove day', available:'Available', fullLanguage:'No places', conflict:'Selected days have an availability conflict', limit:'You can select up to 90 days.', region:'Listing reach', preview:'Listing preview', desktop:'Desktop', mobile:'Mobile', autoImage:'The image is fitted automatically without cropping or distortion.', imageWarning:'If the image contains small text, check readability in the mobile preview.' });
  Object.assign(copy.nl, { hint:'Kies afzonderlijke dagen, ook niet-opeenvolgende. Klik opnieuw om te verwijderen. Maximaal 90 dagen.', selectedCount:'Geselecteerd', hours:'uur zichtbaarheid', removeDate:'Dag verwijderen', available:'Beschikbaar', fullLanguage:'Geen plaatsen', conflict:'De gekozen dagen hebben een beschikbaarheidsconflict', limit:'Je kunt maximaal 90 dagen kiezen.', region:'Bereik van de advertentie', preview:'Advertentievoorbeeld', desktop:'Computer', mobile:'Telefoon', autoImage:'De afbeelding wordt automatisch aangepast zonder bijsnijden of vervormen.', imageWarning:'Controleer kleine tekst op de afbeelding in het mobiele voorbeeld.' });
  Object.assign(copy.fr, { hint:'Choisissez des jours séparément, même non consécutifs. Cliquez à nouveau pour retirer. 90 jours maximum.', selectedCount:'Sélectionnés', hours:'heures de diffusion', removeDate:'Retirer le jour', available:'Disponible', fullLanguage:'Aucune place', conflict:'Les jours choisis présentent un conflit de disponibilité', limit:'Vous pouvez choisir 90 jours maximum.', region:'Portée de l’annonce', preview:'Aperçu de l’annonce', desktop:'Ordinateur', mobile:'Téléphone', autoImage:'L’image est adaptée automatiquement sans recadrage ni déformation.', imageWarning:'Si l’image contient du petit texte, vérifiez sa lisibilité dans l’aperçu mobile.' });
  Object.assign(copy.pl, {image:'Wgraj grafikę JPG, PNG lub WebP (oryginał do 5 MB)',imageError:'Wybierz poprawny plik JPG, PNG lub WebP do 5 MB.',topImage:'TOP: zalecana proporcja 1200 × 720 px. Przygotujemy taki wariant automatycznie.',premiumImage:'PREMIUM: komputer 1200 × 200 px, telefon 660 × 300 px. Oba warianty przygotujemy automatycznie.',mobileImage:'Opcjonalna osobna grafika na telefon (660 × 300 px)'});
  Object.assign(copy.en, {image:'Upload JPG, PNG or WebP artwork (original up to 5 MB)',imageError:'Choose a valid JPG, PNG or WebP file up to 5 MB.',topImage:'TOP: recommended 1200 × 720 px ratio. We prepare this variant automatically.',premiumImage:'PREMIUM: desktop 1200 × 200 px, mobile 660 × 300 px. Both variants are prepared automatically.',mobileImage:'Optional separate mobile artwork (660 × 300 px)'});
  Object.assign(copy.nl, {image:'Upload een JPG-, PNG- of WebP-afbeelding (origineel tot 5 MB)',imageError:'Kies een geldig JPG-, PNG- of WebP-bestand tot 5 MB.',topImage:'TOP: aanbevolen verhouding 1200 × 720 px. Deze variant wordt automatisch gemaakt.',premiumImage:'PREMIUM: computer 1200 × 200 px, telefoon 660 × 300 px. Beide varianten worden automatisch gemaakt.',mobileImage:'Optionele aparte mobiele afbeelding (660 × 300 px)'});
  Object.assign(copy.fr, {image:'Téléversez une image JPG, PNG ou WebP (original de 5 Mo maximum)',imageError:'Choisissez un fichier JPG, PNG ou WebP valide de 5 Mo maximum.',topImage:'TOP : proportions recommandées 1200 × 720 px. Cette variante est créée automatiquement.',premiumImage:'PREMIUM : ordinateur 1200 × 200 px, téléphone 660 × 300 px. Les deux variantes sont créées automatiquement.',mobileImage:'Image mobile distincte facultative (660 × 300 px)'});
  Object.assign(copy.pl, { promotion:'Opublikuj również w innych językach — 50% taniej!', promotionDetail:'Nasz portal odwiedzają również osoby spoza Polski. Publikując ogłoszenie w kilku językach, zwiększasz szansę na dotarcie do nowych klientów.', cheaper:'50% taniej', sourceWarning:'Zmiana języka oryginału nie usuwa wpisanego tekstu. Sprawdź, czy treść nowego języka jest właściwa.', translate:'Przetłumacz automatycznie', translating:'Tłumaczenie trwa…', translateError:'Nie udało się przetłumaczyć. Możesz spróbować ponownie lub wpisać tłumaczenie ręcznie.', translateReview:'Tłumaczenie zostało przygotowane automatycznie. Sprawdź jego poprawność przed zamówieniem ogłoszenia.', overwrite:'Ponowne tłumaczenie zastąpi wpisane wersje dodatkowe. Kontynuować?', fallback:'Nie masz własnej grafiki? Automatycznie przygotujemy estetyczny baner z tytułem i opisem Twojego ogłoszenia. Zobaczysz go w podglądzie przed zakupem.', graphicWarning:'Ważne: Automatyczne tłumaczenie obejmuje wyłącznie tekst wpisany w formularzu. Napisy na przesłanej grafice nie będą tłumaczone. Przy kilku językach użyj grafiki bez napisów lub osobnych wersji językowych.', languageGraphic:'Osobna grafika dla tego języka (opcjonalnie)', tooLong:'Tekst przekracza limit wybranego pakietu. Popraw zaznaczone pola.' });
  Object.assign(copy.en, { promotion:'Publish in other languages too — 50% less!', promotionDetail:'People beyond Poland also visit our site. Publishing in several languages can help you reach new customers.', cheaper:'50% less', sourceWarning:'Changing the original language keeps your text. Check that the new language content is correct.', translate:'Translate automatically', translating:'Translating…', translateError:'Translation failed. Retry or enter it manually.', translateReview:'This translation was generated automatically. Check it before ordering.', overwrite:'Translating again will replace text in the additional languages. Continue?', fallback:'No artwork? We will create a clean banner from your title and description. Preview it before purchase.', graphicWarning:'Important: Automatic translation covers only text entered in the form. Text inside uploaded artwork will not be translated. For multiple languages, use artwork without text or upload separate versions.', languageGraphic:'Separate image for this language (optional)', tooLong:'The text exceeds this package limit. Edit the highlighted fields.' });
  Object.assign(copy.nl, { promotion:'Publiceer ook in andere talen — 50% goedkoper!', promotionDetail:'Ook mensen buiten Polen bezoeken ons portaal. Met meerdere talen bereik je mogelijk nieuwe klanten.', cheaper:'50% goedkoper', sourceWarning:'Een andere brontaal verwijdert uw tekst niet. Controleer of de inhoud bij de nieuwe taal past.', translate:'Automatisch vertalen', translating:'Bezig met vertalen…', translateError:'Vertalen mislukt. Probeer opnieuw of vul de vertaling zelf in.', translateReview:'Deze vertaling is automatisch gemaakt. Controleer haar voor uw bestelling.', overwrite:'Opnieuw vertalen vervangt de ingevulde extra talen. Doorgaan?', fallback:'Geen eigen afbeelding? Wij maken een nette banner met uw titel en beschrijving. Bekijk hem vóór aankoop.', graphicWarning:'Belangrijk: Automatische vertaling geldt alleen voor tekst in het formulier. Tekst in een geüploade afbeelding wordt niet vertaald. Gebruik voor meerdere talen een afbeelding zonder tekst of aparte taalversies.', languageGraphic:'Afzonderlijke afbeelding voor deze taal (optioneel)', tooLong:'De tekst overschrijdt de limiet van dit pakket. Pas de gemarkeerde velden aan.' });
  Object.assign(copy.fr, { promotion:'Publiez aussi dans d’autres langues — 50 % moins cher !', promotionDetail:'Notre portail accueille aussi des visiteurs hors de Pologne. Plusieurs langues peuvent vous aider à toucher de nouveaux clients.', cheaper:'50 % moins cher', sourceWarning:'Changer la langue d’origine conserve votre texte. Vérifiez que le contenu correspond à la nouvelle langue.', translate:'Traduire automatiquement', translating:'Traduction en cours…', translateError:'Échec de la traduction. Réessayez ou saisissez la traduction vous-même.', translateReview:'Cette traduction a été générée automatiquement. Vérifiez-la avant de commander.', overwrite:'Une nouvelle traduction remplacera les textes des langues supplémentaires. Continuer ?', fallback:'Pas de visuel ? Nous créerons une bannière soignée à partir de votre titre et de votre description. Prévisualisez-la avant l’achat.', graphicWarning:'Important : la traduction automatique couvre uniquement le texte saisi dans le formulaire. Le texte d’une image téléversée ne sera pas traduit. Pour plusieurs langues, utilisez une image sans texte ou des versions distinctes.', languageGraphic:'Image distincte pour cette langue (facultatif)', tooLong:'Le texte dépasse la limite de cette formule. Corrigez les champs signalés.' });
  Object.assign(copy.pl, { languageSection:'Język ogłoszenia', languageHint:'Ogłoszenie zostanie najpierw przygotowane w wybranym języku.', extraLanguages:'Dodatkowe języki publikacji', extraHint:'Dotrzyj do większej liczby odbiorców — również poza polską społecznością!', extraCallout:'Zachęcamy do publikacji w kilku językach!', extraCalloutDetail:'Z naszej strony korzystają nie tylko Polacy, ale także mieszkańcy Belgii innych narodowości.', extraFootnote:'Każdy dodatkowy język to 50% taniej od ceny podstawowej.', translateHeading:'Automatyczne tłumaczenie', translateHint:'Możemy automatycznie przetłumaczyć tytuł i treść Twojego ogłoszenia na wybrane języki. Każdą wersję możesz później poprawić.', graphicHeading:'Ważna informacja o grafice', graphicInfo:'Jeśli dodasz własny baner z napisami, nie zostaną one automatycznie przetłumaczone. Tłumaczymy tylko tekst wpisany w formularzu. Możesz przesłać osobne grafiki dla różnych języków.', sampleHeading:'Nie masz własnej grafiki?', sampleInfo:'Możemy automatycznie przygotować estetyczny, spójny z portalem baner z tytułem Twojego ogłoszenia. Zobacz przykładowe wersje:', sampleTitle:'Twoje ogłoszenie', sampleDescription:'Usługi · Produkty · Firma', tipsHeading:'Wskazówki', tips:['Wybierz język ogłoszenia — domyślnie ustawiamy język zgodny z Twoją wersją strony.','Dodaj dodatkowe języki, aby dotrzeć do szerszego grona odbiorców (50% taniej).','Skorzystaj z automatycznego tłumaczenia, a następnie sprawdź i ewentualnie popraw tekst.','Jeśli nie dodasz własnej grafiki, przygotujemy dla Ciebie estetyczny baner.'] });
  Object.assign(copy.en, { languageSection:'Listing language', languageHint:'Your listing will first be prepared in the selected language.', extraLanguages:'Additional publication languages', extraHint:'Reach a wider audience beyond the Polish community.', extraCallout:'Consider publishing in several languages!', extraCalloutDetail:'Our visitors include both Poles and other people living in Belgium.', extraFootnote:'Each additional language costs 50% less than the base price.', translateHeading:'Automatic translation', translateHint:'We can translate your listing title and text into the selected languages. You can edit every version afterwards.', graphicHeading:'Important information about artwork', graphicInfo:'Text embedded in your own banner will not be translated automatically. Only text entered in the form is translated. You can upload separate artwork for each language.', sampleHeading:'No artwork of your own?', sampleInfo:'We can prepare a banner matching the portal using your listing title. See sample versions:', sampleTitle:'Your listing', sampleDescription:'Services · Products · Business', tipsHeading:'Tips', tips:['Choose the listing language; we initially select the language of this page.','Add languages to reach more people at 50% less per extra language.','Use automatic translation, then review and edit the text.','If you do not upload artwork, we will prepare a banner.'] });
  Object.assign(copy.nl, { languageSection:'Advertentietaal', languageHint:'Je advertentie wordt eerst in de gekozen taal opgesteld.', extraLanguages:'Extra publicatietalen', extraHint:'Bereik meer mensen, ook buiten de Poolse gemeenschap.', extraCallout:'Publiceer in meerdere talen!', extraCalloutDetail:'Onze bezoekers zijn zowel Polen als andere inwoners van België.', extraFootnote:'Elke extra taal kost 50% minder dan de basisprijs.', translateHeading:'Automatisch vertalen', translateHint:'We kunnen de titel en tekst naar de gekozen talen vertalen. Daarna kun je elke versie aanpassen.', graphicHeading:'Belangrijke informatie over afbeeldingen', graphicInfo:'Tekst in je eigen banner wordt niet automatisch vertaald. Alleen tekst uit het formulier wordt vertaald. Je kunt per taal een aparte afbeelding uploaden.', sampleHeading:'Geen eigen afbeelding?', sampleInfo:'We kunnen een banner maken die bij de portal past, met de titel van je advertentie. Bekijk voorbeelden:', sampleTitle:'Jouw advertentie', sampleDescription:'Diensten · Producten · Bedrijf', tipsHeading:'Tips', tips:['Kies de advertentietaal; standaard gebruiken we de taal van deze pagina.','Voeg talen toe om meer mensen te bereiken, met 50% korting per extra taal.','Gebruik automatisch vertalen en controleer daarna de tekst.','Zonder eigen afbeelding maken we een banner voor je.'] });
  Object.assign(copy.fr, { languageSection:'Langue de l’annonce', languageHint:'Votre annonce sera d’abord préparée dans la langue choisie.', extraLanguages:'Langues de publication supplémentaires', extraHint:'Touchez davantage de personnes, au-delà de la communauté polonaise.', extraCallout:'Publiez en plusieurs langues !', extraCalloutDetail:'Nos visiteurs comprennent des Polonais et d’autres habitants de Belgique.', extraFootnote:'Chaque langue supplémentaire coûte 50 % de moins que le prix de base.', translateHeading:'Traduction automatique', translateHint:'Nous pouvons traduire le titre et le texte dans les langues choisies. Vous pourrez ensuite modifier chaque version.', graphicHeading:'Information importante sur les visuels', graphicInfo:'Le texte intégré à votre bannière ne sera pas traduit automatiquement. Seul le texte saisi dans le formulaire est traduit. Vous pouvez envoyer un visuel distinct pour chaque langue.', sampleHeading:'Vous n’avez pas de visuel ?', sampleInfo:'Nous pouvons créer une bannière assortie au portail avec le titre de votre annonce. Voici des exemples :', sampleTitle:'Votre annonce', sampleDescription:'Services · Produits · Entreprise', tipsHeading:'Conseils', tips:['Choisissez la langue de l’annonce ; celle de cette page est sélectionnée par défaut.','Ajoutez des langues pour toucher plus de monde, avec 50 % de réduction par langue supplémentaire.','Utilisez la traduction automatique puis vérifiez et corrigez le texte.','Sans visuel personnel, nous préparerons une bannière.'] });
  Object.assign(copy.pl, {perDay:'za dzień',premiumPlacement:'Szeroki baner na samej górze strony',topPlacement:'Mniejsza karta w karuzeli wyróżnionych ogłoszeń',topTextPreview:'W pakiecie TOP również ogłoszenie tekstowe otrzyma granatowo-czerwony szablon banera.'});
  Object.assign(copy.en, {perDay:'per day',premiumPlacement:'Wide banner at the very top of the page',topPlacement:'Smaller card in the featured listings carousel',topTextPreview:'A TOP text listing also receives the navy and red banner template.'});
  Object.assign(copy.nl, {perDay:'per dag',premiumPlacement:'Brede banner helemaal bovenaan de pagina',topPlacement:'Kleinere kaart in de carrousel met uitgelichte advertenties',topTextPreview:'Ook een TOP-tekstadvertentie krijgt de donkerblauwe en rode bannersjabloon.'});
  Object.assign(copy.fr, {perDay:'par jour',premiumPlacement:'Grande bannière tout en haut de la page',topPlacement:'Carte plus petite dans le carrousel des annonces à la une',topTextPreview:'Une annonce textuelle TOP reçoit aussi le modèle de bannière bleu marine et rouge.'});
  Object.assign(copy.pl, { publicData:'Dane kontaktowe do ogłoszenia',publicHint:'Te dane będą widoczne publicznie w Twoim ogłoszeniu. Podaj tylko te informacje, które chcesz udostępnić odbiorcom.',buyerData:'Dane zamawiającego',company:'Nazwa firmy lub reklamodawcy (opcjonalnie)',publicPhone:'Telefon kontaktowy (opcjonalnie)',publicEmail:'E-mail kontaktowy (opcjonalnie)',url:'Strona internetowa (opcjonalnie)',otherContact:'Inny kontakt publiczny (opcjonalnie)',clickWebsite:'Kliknięcie banera otworzy Twoją stronę w nowej karcie.',clickDetails:'Kliknięcie banera pokaże publiczne dane kontaktowe.',clickNone:'Baner bez strony i kontaktu nie będzie klikalny.',clickStandard:'„Czytaj całość” pokaże pełną treść i publiczne dane kontaktowe.',publicPreview:'Publicznie w ogłoszeniu',privatePreview:'Tylko do obsługi zamówienia' });
  Object.assign(copy.en, { publicData:'Contact details for the listing',publicHint:'These details will be public in your listing. Enter only information you want to share with readers.',buyerData:'Purchaser details',company:'Company or advertiser name (optional)',publicPhone:'Contact phone (optional)',publicEmail:'Contact email (optional)',url:'Website (optional)',otherContact:'Other public contact (optional)',clickWebsite:'Clicking the banner opens your website in a new tab.',clickDetails:'Clicking the banner shows your public contact details.',clickNone:'A banner without a website or contact details is not clickable.',clickStandard:'“Read more” shows the full listing and public contact details.',publicPreview:'Public in the listing',privatePreview:'For order handling only' });
  Object.assign(copy.nl, { publicData:'Contactgegevens voor de advertentie',publicHint:'Deze gegevens zijn openbaar in je advertentie. Vul alleen in wat je met bezoekers wilt delen.',buyerData:'Gegevens van de besteller',company:'Bedrijf of naam van adverteerder (optioneel)',publicPhone:'Contacttelefoon (optioneel)',publicEmail:'Contact-e-mail (optioneel)',url:'Website (optioneel)',otherContact:'Ander openbaar contact (optioneel)',clickWebsite:'Een klik op de banner opent je website in een nieuw tabblad.',clickDetails:'Een klik op de banner toont je openbare contactgegevens.',clickNone:'Een banner zonder website of contactgegevens is niet aanklikbaar.',clickStandard:'“Lees meer” toont de volledige advertentie en openbare contactgegevens.',publicPreview:'Openbaar in de advertentie',privatePreview:'Alleen voor de afhandeling van de bestelling' });
  Object.assign(copy.fr, { publicData:'Coordonnées de l’annonce',publicHint:'Ces données seront publiques dans votre annonce. Indiquez seulement les informations que vous souhaitez partager.',buyerData:'Coordonnées de l’acheteur',company:'Entreprise ou nom de l’annonceur (facultatif)',publicPhone:'Téléphone de contact (facultatif)',publicEmail:'E-mail de contact (facultatif)',url:'Site internet (facultatif)',otherContact:'Autre contact public (facultatif)',clickWebsite:'Un clic sur la bannière ouvre votre site dans un nouvel onglet.',clickDetails:'Un clic sur la bannière affiche vos coordonnées publiques.',clickNone:'Sans site ni coordonnées, la bannière n’est pas cliquable.',clickStandard:'« Lire la suite » affiche l’annonce complète et les coordonnées publiques.',publicPreview:'Public dans l’annonce',privatePreview:'Réservé au traitement de la commande' });
  Object.assign(copy.pl,{phoneInvalid:'Podaj poprawny numer telefonu (co najmniej 6 cyfr).',urlInvalid:'Podaj adres strony zaczynający się od http:// lub https://, bez danych logowania.'});
  Object.assign(copy.en,{phoneInvalid:'Enter a valid phone number with at least 6 digits.',urlInvalid:'Enter an http:// or https:// website without login details.'});
  Object.assign(copy.nl,{phoneInvalid:'Vul een geldig telefoonnummer met minstens 6 cijfers in.',urlInvalid:'Vul een website met http:// of https:// in, zonder inloggegevens.'});
  Object.assign(copy.fr,{phoneInvalid:'Saisissez un numéro de téléphone valide d’au moins 6 chiffres.',urlInvalid:'Saisissez un site en http:// ou https://, sans identifiants.'});
  const languages = window.siteLanguages;
  const keys = Object.keys(languages).filter(language => language !== 'en');
  const visualOrder = ['pl','nl','fr'].filter(language => keys.includes(language));
  const visualNames = {pl:{pl:'Polski',nl:'Niderlandzki',fr:'Francuski',en:'Angielski'},en:{pl:'Polish',nl:'Dutch',fr:'French',en:'English'},nl:{pl:'Pools',nl:'Nederlands',fr:'Frans',en:'Engels'},fr:{pl:'Polonais',nl:'Néerlandais',fr:'Français',en:'Anglais'}};
  const dialog = document.createElement('dialog');
  dialog.id = 'order-dialog';
  dialog.setAttribute('aria-labelledby', 'order-title');
  document.body.append(dialog);

  let config, selectedLanguages = ['pl'], primaryLanguage = 'pl', type = 'TOP', kind = 'text', month = '';
  let chosenDates = [], conflicts = {}, region = 'all', drafts = {}, titles = {}, descriptions = {};
  let sampleLanguage = 'pl';
  let contact = '', email = '', company = '', publicPhone = '', publicEmail = '', url = '', customerName = '', imageData = '', imageName = '', mobileImageData = '', mobileImageName = '', languageImages = {};
  const limits = { PREMIUM:{title:70,description:200}, TOP:{title:60,description:160}, STANDARD:{title:70,description:500} };
  const length = value => Array.from(value || '').length;
  let requestId = crypto.randomUUID(), version = 0, availabilityReady = false, pending = false, restoreFocus, locale = 'pl';
  let adminMode = false, adminComplimentary = true, adminStatus = 'approved', editId = '', editVersion = 0, editPaymentAmount = 0, editOriginalDates = [], editDatesTouched = false;
  let demoMode = false, demoRequest, liveApi = false;
  const $ = selector => dialog.querySelector(selector);
  const t = key => (copy[locale] || copy.pl)[key] || copy.pl[key];
  const node = (tag, value = '', className = '') => { const element = document.createElement(tag); element.textContent = value; if (className) element.className = className; return element; };
  const dateAt = (date, offset) => new Date(Date.parse(date) + offset * 86400000).toISOString().slice(0, 10);
  const money = cents => new Intl.NumberFormat(languages[locale]?.locale || 'pl-PL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  async function fitImage(file, width, height) {
    if (!file || file.size > 5_000_000 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('imageError');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width < 100 || bitmap.height < 100 || bitmap.width * bitmap.height > 40_000_000) throw new Error('imageError');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); context.fillStyle = '#eef3f7'; context.fillRect(0,0,width,height);
      const scale = Math.min(width / bitmap.width, height / bitmap.height);
      const fittedWidth = Math.round(bitmap.width * scale), fittedHeight = Math.round(bitmap.height * scale);
      context.drawImage(bitmap, Math.round((width - fittedWidth) / 2), Math.round((height - fittedHeight) / 2), fittedWidth, fittedHeight);
      for (const quality of [.86,.76,.66,.55,.43]) {
        const data = canvas.toDataURL('image/webp', quality);
        if (data.length < 680000) return data;
      }
      throw new Error('imageError');
    } finally { bitmap.close(); }
  }

  async function api(action, params = {}, body) {
    if (action === 'config' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
      try { const response = await fetch('/api/ads?action=config', { cache: 'no-store' }); if (response.ok) { liveApi = true; demoMode = false; return response.json(); } } catch { /* A static preview can use local examples. */ }
    }
    if (!liveApi && ['localhost', '127.0.0.1'].includes(location.hostname)) {
      demoRequest ||= fetch('/local-demo-order.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).catch(() => null);
      const demo = await demoRequest;
      if (demo) {
        demoMode = true;
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
        if (action === 'config') return { ...demo, languages, today };
        if (action === 'availability') {
          const capacity = demo.data.types[params.type]?.capacity || 0;
          const daysAvailable = [];
          for (let date = params.startDate; date <= params.endDate; date = dateAt(date, 1)) {
            const booked = (params.type === 'TOP' && date === dateAt(today, 2)) || (params.type === 'PREMIUM' && date === dateAt(today, 3)) ? capacity : 0;
            daysAvailable.push({ date, remaining: capacity - booked });
          }
          return { enabled: demo.data.markets[params.language]?.enabled === true && (params.type !== 'PREMIUM' || demo.data.markets[params.language]?.prices.PREMIUM > 0), daysAvailable };
        }
        if (action === 'order-batch') return { demo: true };
      }
    }
    const requestAction = action === 'availability' && adminMode && editId ? 'admin-availability' : action;
    const requestParams = requestAction === 'admin-availability' ? { ...params, id: editId } : params;
    const response = await fetch('/api/ads?' + new URLSearchParams({ action: requestAction, ...requestParams }), body
      ? { method: action === 'admin-revise-group' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function paymentApi(action, params = {}, body) {
    const response = await fetch('/api/ads-payment?' + new URLSearchParams({ action, ...params }), body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'paymentUnavailable');
    return payload;
  }

  function capture() {
    dialog.querySelectorAll('[data-copy]').forEach(field => { drafts[field.dataset.copy] = field.value; });
    dialog.querySelectorAll('[data-title]').forEach(field => { titles[field.dataset.title] = field.value; });
    dialog.querySelectorAll('[data-description]').forEach(field => { descriptions[field.dataset.description] = field.value; });
    contact = $('[name=contact]')?.value ?? contact;
    publicPhone = $('[name=publicPhone]')?.value ?? publicPhone;
    publicEmail = $('[name=publicEmail]')?.value ?? publicEmail;
    email = $('[name=email]')?.value ?? email;
    company = $('[name=company]')?.value ?? company;
    url = $('[name=url]')?.value ?? url;
    customerName = $('[name=customerName]')?.value ?? customerName;
  }
  function total() {
    if (!config || !chosenDates.length || !type) return 0;
    const base = chosenDates.length * (config.data.markets[primaryLanguage]?.prices[type] || 0);
    return base + selectedLanguages.filter(language => language !== primaryLanguage).length * Math.round(base / 2);
  }
  const clickBehavior = () => type === 'STANDARD' ? t('clickStandard') : url.trim() ? t('clickWebsite') : [publicPhone,publicEmail,contact].some(value => value.trim()) ? t('clickDetails') : t('clickNone');
  const timing = () => {
    if (!chosenDates.length) return '';
    if (chosenDates.includes(config.today)) return t('todayTiming');
    const at = Date.parse(`${chosenDates[0]}T00:00:00Z`);
    const zone = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset' }).formatToParts(new Date(at)).find(part => part.type === 'timeZoneName').value.match(/GMT([+-])(\d{1,2})/);
    const start = new Date(at - (zone[1] === '+' ? 1 : -1) * Number(zone[2]) * 3600000);
    const end = new Date(start.getTime() + 86400000);
    const format = new Intl.DateTimeFormat(languages[locale]?.locale || 'pl-PL', { timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short' });
    return `${t('plannedStart')}: ${format.format(start)}; ${t('plannedEnd')}: ${format.format(end)} (${t('brusselsTime')})`;
  };
  function summary() {
    if (!$('#chosen-days')) return;
    $('#chosen-days').textContent = `${t('selectedCount')}: ${chosenDates.length} ${t('days')} — ${chosenDates.length * 24} ${t('hours')}`;
    $('#chosen-date-tags').replaceChildren(...chosenDates.map(date => { const button = node('button', `${date} ×`, 'chosen-day'); button.type = 'button'; button.setAttribute('aria-label', `${t('removeDate')} ${date}`); button.onclick = () => chooseDate(date); return button; }));
    $('#order-total').textContent = money(editId ? editPaymentAmount : adminMode && adminComplimentary ? 0 : total());
    if ($('#order-click-behavior')) $('#order-click-behavior').textContent = clickBehavior();
    if ($('#order-breakdown')) { const base = chosenDates.length * (config?.data.markets[primaryLanguage]?.prices[type] || 0); $('#order-breakdown').textContent = `${t('baseLanguage')}: ${languages[primaryLanguage]?.name} — ${money(base)}. ${t('extraLanguages')}: ${selectedLanguages.filter(language => language !== primaryLanguage).map(language => `${languages[language].name} ${money(Math.round(base / 2))}`).join(', ') || '—'}. ${chosenDates.length} ${t('days')} = ${chosenDates.length * 24} h. ${timing()}`; }
    const invalid = [...dialog.querySelectorAll('[data-title],[data-description]')].some(field => length(field.value) > limits[type][field.dataset.title ? 'title' : 'description']);
    $('#order-review').disabled = !availabilityReady || (!chosenDates.length && !(editId && !editDatesTouched && editOriginalDates.length)) || Object.keys(conflicts).some(date => chosenDates.includes(date)) || !selectedLanguages.length || !type || !config || invalid;
    dialog.querySelectorAll('#order-calendar button[data-date]').forEach(button => {
      const date = button.dataset.date;
      button.setAttribute('aria-pressed', String(chosenDates.includes(date)));
    });
  }
  function drawExampleBanners() {
    const active = selectedLanguages.includes(sampleLanguage) ? sampleLanguage : primaryLanguage;
    const title = dialog.querySelector(`[data-title="${active}"]`)?.value || titles[active] || t('sampleTitle');
    const description = dialog.querySelector(`[data-description="${active}"]`)?.value || descriptions[active] || t('sampleDescription');
    const advertiser = ($('[name=company]')?.value ?? company).trim();
    for (const sampleType of ['PREMIUM','TOP']) $('#order-example-' + sampleType.toLowerCase())?.replaceChildren(window.buildAdCreative({type:sampleType,title,description,company:advertiser,publicPhone:($('[name=publicPhone]')?.value ?? publicPhone).trim(),publicEmail:($('[name=publicEmail]')?.value ?? publicEmail).trim(),contact:($('[name=contact]')?.value ?? contact).trim()}));
  }
  function setMessage(key) { $('#order-message').textContent = key ? t(key) : ''; }
  function showFields(captureExisting = true) {
    if (captureExisting) capture();
    if (type === 'STANDARD') kind = 'text';
    if (type === 'PREMIUM') kind = 'image';
    for (const value of ['text', 'image']) {
      const choice = dialog.querySelector(`[name=kind][value=${value}]`);
      choice.closest('label').hidden = (type === 'STANDARD' && value === 'image') || (type === 'PREMIUM' && value === 'text');
      choice.checked = kind === value;
    }
    $('#order-image-hint').textContent = t(type === 'PREMIUM' ? 'premiumImage' : 'topImage');
    $('#order-mobile-image').hidden = type !== 'PREMIUM';
    $('[name=imageFile]').required = false;
    $('[name=imageMobileFile]').required = false;
    const text = $('#order-text-fields'), banner = $('#order-banner-fields');
    text.hidden = kind !== 'text'; banner.hidden = kind !== 'image';
    $('#order-format-note').hidden = !(type === 'TOP' && kind === 'text');
    text.querySelectorAll('textarea,input').forEach(field => { field.disabled = kind !== 'text'; });
    banner.querySelectorAll('textarea,input').forEach(field => { field.disabled = kind !== 'image'; });
    const textBox = $('#order-texts'), bannerBox = $('#order-banner-copy');
    textBox.replaceChildren(); bannerBox.replaceChildren();
    for (const language of selectedLanguages) {
      const heading = node('strong', languages[language].name, 'order-language-heading');
      {
        const wrapper = node('div', '', 'order-banner-language'); wrapper.append(heading);
        for (const [key, labelText, values] of [['title', t('bannerTitle'), titles], ['description', t('bannerDescription'), descriptions]]) {
          const label = node('label', labelText); const field = key === 'title' ? document.createElement('input') : document.createElement('textarea');
          field.dataset[key] = language; field.required = true; field.value = values[language] || '';
          if (key === 'description') field.rows = 3;
          const counter = node('small', '', 'order-counter');
          const update = () => { counter.textContent = `${length(field.value)}/${limits[type][key]}`; field.setCustomValidity(length(field.value) > limits[type][key] ? t('tooLong') : ''); field.classList.toggle('is-over-limit',length(field.value) > limits[type][key]); summary(); };
          field.addEventListener('input', update); label.append(field,counter); wrapper.append(label); update();
        }
        if (kind === 'image' && language !== primaryLanguage) {
          const label = node('label', t('languageGraphic'));
          const field = document.createElement('input'); field.type = 'file'; field.accept = 'image/png,image/jpeg,image/webp'; field.dataset.languageImage = language;
          field.onchange = async () => { try { const file = field.files[0]; languageImages[language] = file ? { image:await fitImage(file,1200,type === 'PREMIUM' ? 200 : 720), imageMobile:type === 'PREMIUM' ? await fitImage(file,660,300) : '' } : null; setMessage(''); } catch { setMessage('imageError'); field.value=''; } };
          label.append(field); wrapper.append(label);
        }
        (kind === 'text' ? textBox : bannerBox).append(wrapper);
      }
    }
    $('#order-translate').disabled = selectedLanguages.length < 2;
    summary(); drawExampleBanners();
  }

  async function chooseDate(date) {
    if (editId) editDatesTouched = true;
    if (chosenDates.includes(date)) chosenDates = chosenDates.filter(value => value !== date);
    else if (chosenDates.length >= 90) { setMessage('limit'); return; }
    else chosenDates = [...chosenDates, date].sort();
    requestId = crypto.randomUUID(); setMessage(''); summary(); calendar();
  }
  async function calendar() {
    const serial = ++version;
    availabilityReady = false; summary();
    const grid = $('#order-calendar'); grid.replaceChildren();
    if (!config || !type || !selectedLanguages.length) { summary(); return; }
    const [year, monthNumber] = month.split('-').map(Number);
    $('#order-month-label').textContent = new Intl.DateTimeFormat(languages[locale]?.locale || 'pl-PL', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
    const first = `${month}-01`, last = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const lastAllowed = dateAt(config.today, 730);
    $('#month-prev').disabled = month <= config.today.slice(0, 7);
    $('#month-next').disabled = month >= lastAllowed.slice(0, 7);
    for (let index = 0; index < 7; index++) grid.append(node('span', new Intl.DateTimeFormat(languages[locale]?.locale || 'pl-PL', { weekday: 'short' }).format(new Date(2026, 5, 1 + index)), 'calendar-weekday'));
    const spaces = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    for (let index = 0; index < spaces; index++) grid.append(node('span'));
    for (let day = 1; day <= Number(last.slice(-2)); day++) { const date = `${month}-${String(day).padStart(2,'0')}`; const button = node('button', String(day)); button.type = 'button'; button.disabled = true; button.classList.toggle('is-holiday',!!(window.PbeCalendar?.holidays(date).some(item => item.scope === 'federal') || window.PbeCalendar?.sunday(date))); button.classList.toggle('is-today',date === window.PbeCalendar?.today()); grid.append(button); }
    if (last < config.today || first > lastAllowed) { availabilityReady = true; summary(); return; }
    $('#calendar-status').textContent = t('loading');
    try {
      const availability = await Promise.all(selectedLanguages.map(async language => ({ language, ...await api('availability', { language, type, startDate: first < config.today ? config.today : first, endDate: last > lastAllowed ? lastAllowed : last, durationDays: 1 }) })));
      if (serial !== version) return;
      $('#calendar-status').textContent = '';
      conflicts = {};
      grid.querySelectorAll('button').forEach((button, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const blocked = availability.filter(result => !result.enabled || (result.daysAvailable.find(day => day.date === date)?.remaining ?? 0) < 1).map(result => languages[result.language].name);
        const free = date >= config.today && date <= lastAllowed && !blocked.length;
        button.dataset.date = date; button.disabled = date < config.today || date > lastAllowed || !free && !chosenDates.includes(date);
        if (blocked.length) conflicts[date] = blocked;
        button.append(node('small', free ? t('available') : `${t('fullLanguage')}: ${blocked.join(', ')}`, 'calendar-slots'));
        button.setAttribute('aria-label', `${new Intl.DateTimeFormat(languages[locale]?.locale || 'pl-PL', { dateStyle: 'full' }).format(new Date(`${date}T12:00:00`))}, ${free ? t('available') : `${t('fullLanguage')}: ${blocked.join(', ')}`}`);
        button.onclick = () => chooseDate(date);
      });
      for (const otherMonth of new Set(chosenDates.map(date => date.slice(0,7)).filter(value => value !== month))) {
        const monthDates = chosenDates.filter(date => date.startsWith(otherMonth));
        const other = await Promise.all(selectedLanguages.map(async language => ({ language, ...await api('availability', { language, type, startDate: monthDates[0], endDate: monthDates.at(-1), durationDays: 1 }) })));
        if (serial !== version) return;
        for (const date of monthDates) {
          const blocked = other.filter(result => !result.enabled || (result.daysAvailable.find(day => day.date === date)?.remaining ?? 0) < 1).map(result => languages[result.language].name);
          if (blocked.length) conflicts[date] = blocked;
        }
      }
      const conflictDates = chosenDates.filter(date => conflicts[date]);
      if (conflictDates.length) $('#calendar-status').textContent = `${t('conflict')}: ${conflictDates.map(date => `${date} (${conflicts[date].join(', ')})`).join('; ')}`;
      availabilityReady = true;
      summary();
    } catch { if (serial === version) { $('#calendar-status').textContent = ''; setMessage('error'); } }
  }

  function render() {
    const termsHref = document.documentElement.lang === 'pl' ? '/regulamin-ogloszen/' : `/${document.documentElement.lang}/regulamin-ogloszen/`;
    const privacyHref = document.documentElement.lang === 'pl' ? '/polityka-prywatnosci/' : `/${document.documentElement.lang}/polityka-prywatnosci/`;
    dialog.innerHTML = `<div class="order-heading"><div><span class="eyebrow">Polacy w Belgii</span><h2 id="order-title">${t('title')}</h2></div><button type="button" id="order-close" aria-label="${t('close')}">×</button></div>
      <p>${t('intro')}</p>${demoMode ? `<p class="order-demo" role="note">${t('demoNotice')}</p>` : ''}<p id="order-message" role="status"></p>
      <form id="order-form"><fieldset class="order-panel order-panel--primary"><legend><span aria-hidden="true">◎</span> ${t('languageSection')}</legend><p>${t('languageHint')}</p><select id="order-primary" class="order-primary-native" aria-label="${t('baseLanguage')}" tabindex="-1">${keys.map(language => `<option value="${language}" ${language === primaryLanguage ? 'selected' : ''}>${languages[language].name}</option>`).join('')}</select><div class="order-primary-choices">${visualOrder.map(language => `<label class="order-primary-choice"><input type="radio" name="primaryChoice" value="${language}" ${language===primaryLanguage?'checked':''}><span class="order-flag order-flag--${language}" aria-hidden="true"></span><span>${visualNames[locale]?.[language] || languages[language].name}</span></label>`).join('')}</div></fieldset>
      <fieldset class="order-panel order-panel--languages"><legend><span aria-hidden="true">▱</span> ${t('extraLanguages')}</legend><p>${t('extraHint')}</p><div class="order-extra-callout"><strong>${t('extraCallout')}</strong><span>${t('extraCalloutDetail')}</span></div><input type="checkbox" name="languages" value="${primaryLanguage}" checked disabled hidden><div class="order-language-choices">${visualOrder.filter(language=>language!==primaryLanguage).map(language => `<label class="order-choice order-choice--language"><input type="checkbox" name="languages" value="${language}" ${selectedLanguages.includes(language) ? 'checked' : ''}><span class="order-flag order-flag--${language}" aria-hidden="true"></span><span class="order-choice__title">${visualNames[locale]?.[language] || languages[language].name}</span><span class="order-choice__badge">${t('cheaper')}</span></label>`).join('')}</div><p class="order-extra-footnote">ⓘ ${t('extraFootnote')}</p></fieldset>
      <section class="order-info-card order-info-card--translate"><h3><span aria-hidden="true">✧</span> ${t('translateHeading')}</h3><p>${t('translateHint')}</p><div id="order-translate-box"><button type="button" class="secondary" id="order-translate">${t('translate')}</button><p id="order-translation-status" role="status"></p><div id="order-turnstile"></div></div></section>
      <section class="order-info-card order-info-card--graphic"><h3><span aria-hidden="true">▧</span> ${t('graphicHeading')}</h3><p>${t('graphicInfo')}</p></section>
      <aside id="order-aside"><div class="order-aside-sticky"><section class="order-sample-card"><h3><span aria-hidden="true">▣</span> ${t('sampleHeading')}</h3><p>${t('sampleInfo')}</p><div class="order-sample-block order-sample-block--premium"><div class="order-sample-meta"><strong>PREMIUM <small>1200 × 200 px · 660 × 300 px</small></strong><span id="order-example-premium-price"></span></div><p>${t('premiumPlacement')}</p><div id="order-example-premium"></div></div><div class="order-sample-block order-sample-block--top"><div class="order-sample-meta"><strong>TOP <small>1200 × 720 px</small></strong><span id="order-example-top-price"></span></div><p>${t('topPlacement')}</p><div id="order-example-top"></div></div></section><section class="order-tips-card"><h3><span aria-hidden="true">♧</span> ${t('tipsHeading')}</h3><ul>${t('tips').map(item=>`<li>${item}</li>`).join('')}</ul></section></div></aside>
      <fieldset class="order-panel order-panel--placement"><legend>${t('placement')}</legend><div class="order-placement-choices">${['STANDARD', 'TOP', 'PREMIUM'].map(value => { const [name, detail] = t(value.toLowerCase()).split(' — '); return `<label class="order-choice order-choice--placement"><input type="radio" name="type" value="${value}" ${type === value ? 'checked' : ''}><span class="order-choice__copy"><strong class="order-choice__title">${name}</strong><span class="order-choice__detail">${detail || ''}</span></span></label>`; }).join('')}</div></fieldset>
      <fieldset class="order-panel order-panel--format"><legend>${t('format')}</legend><div class="order-format-options"><label class="order-choice order-choice--format"><input type="radio" name="kind" value="text" ${kind === 'text' ? 'checked' : ''}><span class="order-choice__title">${t('text')}</span></label><label class="order-choice order-choice--format"><input type="radio" name="kind" value="image" ${kind === 'image' ? 'checked' : ''}><span class="order-choice__title">${t('banner')}</span></label></div><p id="order-format-note" hidden>${t('topTextPreview')}</p></fieldset>
      <label>${t('region')}<select id="order-region">${['all','flanders','wallonia','brussels'].map(value => `<option value="${value}" ${region === value ? 'selected' : ''}>${({pl:{all:'Cała Belgia',flanders:'Flandria',wallonia:'Walonia',brussels:'Bruksela'},en:{all:'All Belgium',flanders:'Flanders',wallonia:'Wallonia',brussels:'Brussels'},nl:{all:'Heel België',flanders:'Vlaanderen',wallonia:'Wallonië',brussels:'Brussel'},fr:{all:'Toute la Belgique',flanders:'Flandre',wallonia:'Wallonie',brussels:'Bruxelles'}}[locale] || {})[value]}</option>`).join('')}</select></label>
      <fieldset id="order-calendar-step"><legend>${t('dates')}</legend><p>${t('hint')}</p>
      <div class="order-month"><button type="button" id="month-prev" aria-label="${t('previous')}">‹</button><strong id="order-month-label"></strong><button type="button" id="month-next" aria-label="${t('next')}">›</button></div><p id="calendar-status" role="status"></p><div id="order-calendar"></div><p><strong id="chosen-days"></strong></p><div id="chosen-date-tags"></div></fieldset>
      <fieldset id="order-text-fields"><legend>${t('textContent')}</legend><div id="order-texts"></div></fieldset>
      <fieldset id="order-banner-fields" hidden><legend>${t('bannerContent')}</legend><div id="order-banner-copy"></div><p id="order-image-hint"></p><p>${t('fallback')}</p><p>${t('graphicWarning')}</p><label>${t('image')}<input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p id="order-image-name"></p><div id="order-mobile-image"><label>${t('mobileImage')}<input name="imageMobileFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p id="order-mobile-image-name"></p></div><p class="order-note">${t('imageWarning')}</p></fieldset>
      <fieldset id="order-public-fields"><legend>${t('publicData')}</legend><p>${t('publicHint')}</p><label>${t('company')}<input name="company" maxlength="120"></label><label>${t('publicPhone')}<input name="publicPhone" type="tel" maxlength="40"></label><label>${t('publicEmail')}<input name="publicEmail" type="email" maxlength="254"></label><label>${t('url')}<input name="url" type="url" maxlength="2048" placeholder="https://"></label><label>${t('otherContact')}<input name="contact" maxlength="160"></label><p id="order-click-behavior" class="order-note"></p></fieldset>
      <fieldset id="order-buyer-fields"><legend>${t('buyerData')}</legend><label>${t('customer')}<input name="customerName" maxlength="120" required></label><label>${t('email')}<input name="email" type="email" maxlength="254" autocomplete="email" required><small>${t('privacy')}</small></label></fieldset>
      <p class="order-note">${t('privacyNotice')} <a href="${privacyHref}" target="_blank" rel="noopener">${t('privacyPolicy')}</a>.</p><label class="order-choice"><input name="consent" type="checkbox" required>${t('consent')}</label><label class="order-choice"><input name="termsAccepted" type="checkbox" required>${t('terms')} <a href="${termsHref}" target="_blank" rel="noopener">↗</a></label><label class="order-choice"><input name="earlyServiceRequest" type="checkbox">${t('earlyService')}</label>${adminMode ? `<fieldset class="order-panel"><legend>${editId ? 'Edycja emisji' : 'Publikacja administratora'}</legend>${editId ? '' : `<label class="order-choice"><input name="adminComplimentary" type="checkbox" ${adminComplimentary ? 'checked' : ''}>Dodaj bezpłatnie (administrator)</label>`}<label>Po zapisaniu<select name="adminStatus"><option value="approved" ${adminStatus === 'approved' ? 'selected' : ''}>Zatwierdź i opublikuj w wybranym terminie</option><option value="pending" ${adminStatus === 'pending' ? 'selected' : ''}>Pozostaw do późniejszego zatwierdzenia</option>${editId ? `<option value="paused" ${adminStatus === 'paused' ? 'selected' : ''}>Wstrzymaj emisję</option><option value="rejected" ${adminStatus === 'rejected' ? 'selected' : ''}>Odrzuć</option><option value="cancelled" ${adminStatus === 'cancelled' ? 'selected' : ''}>Wycofaj</option>` : ''}</select></label><p class="order-note">${editId ? 'Edycja nie zmienia historii płatności Stripe. Zmiana pakietu lub terminu wymaga wolnego miejsca.' : 'Bezpłatne ogłoszenie nie przechodzi przez Stripe i nie będzie oznaczone jako opłacone.'}</p></fieldset>` : ''}<p id="order-breakdown" class="order-note"></p><div class="order-total"><span>${editId ? 'Płatność za pierwotne zamówienie' : t('total')}</span><strong id="order-total"></strong></div><p class="order-note">${editId ? 'Zmiany administratora nie pobierają kolejnej płatności.' : adminMode && adminComplimentary ? 'Do zapłaty: 0 €. Obowiązuje limit miejsc wybranego pakietu.' : demoMode ? t('unpaid') : config.paymentsEnabled ? t('payNote') : t('paymentDisabled')}</p><button class="button" id="order-review">${t('review')}</button></form><section id="order-confirm" hidden></section>`;
    $('[name=contact]').value = contact; $('[name=publicPhone]').value = publicPhone; $('[name=publicEmail]').value = publicEmail; $('[name=email]').value = email; $('[name=company]').value = company; $('[name=url]').value = url; $('[name=customerName]').value = customerName;
    for (const sampleType of ['PREMIUM','TOP']) { const price = config?.data.markets[primaryLanguage]?.prices[sampleType]; $('#order-example-' + sampleType.toLowerCase() + '-price').textContent = price ? `${money(price)} ${t('perDay')}` : ''; }
    $('[name=imageFile]').required = false;
    $('#order-image-name').textContent = imageName;
    $('#order-mobile-image-name').textContent = mobileImageName;
    $('#order-close').onclick = () => dialog.close();
    if (adminMode) {
      if (!editId) $('[name=adminComplimentary]').onchange = event => { adminComplimentary = event.target.checked; summary(); };
      $('[name=adminStatus]').onchange = event => { adminStatus = event.target.value; };
    }
    if (config.turnstileSiteKey) {
      const mountTurnstile = () => { if (!dialog.open || !$('#order-turnstile') || !window.turnstile) return; window.turnstile.render($('#order-turnstile'),{sitekey:config.turnstileSiteKey}); };
      if (window.turnstile) mountTurnstile(); else { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.onload = mountTurnstile; document.head.append(script); }
    }
    $('#order-translate').onclick = async () => {
      capture();
      const targets = selectedLanguages.filter(language => language !== primaryLanguage);
      if (!targets.length) return;
      if (targets.some(language => titles[language] || descriptions[language]) && !window.confirm(t('overwrite'))) return;
      const button = $('#order-translate'), status = $('#order-translation-status'); button.disabled = true; status.textContent = t('translating');
      try {
        const result = await api('translate',{}, { sourceLanguage:primaryLanguage, targets, type, title:titles[primaryLanguage], description:descriptions[primaryLanguage], turnstileToken:window.turnstile?.getResponse?.() || '' });
        for (const variant of result.variants) { titles[variant.language] = variant.title; descriptions[variant.language] = variant.description; }
        showFields(false); status.textContent = t('translateReview');
      } catch { status.textContent = t('translateError'); }
      finally { button.disabled = false; }
    };
    $('#order-primary').onchange = () => {
      capture(); const next = $('#order-primary').value;
      if (next !== primaryLanguage && Object.values({...titles,...descriptions}).some(Boolean) && !window.confirm(t('sourceWarning'))) { $('#order-primary').value = primaryLanguage; dialog.querySelector(`[name=primaryChoice][value=${primaryLanguage}]`).checked = true; return; }
      primaryLanguage = next;
      sampleLanguage = next;
      if (!selectedLanguages.includes(primaryLanguage)) { selectedLanguages.push(primaryLanguage); dialog.querySelector(`[name=languages][value=${primaryLanguage}]`).checked = true; }
      requestId = crypto.randomUUID(); render();
    };
    dialog.querySelectorAll('[name=primaryChoice]').forEach(input => input.onchange = () => { $('#order-primary').value = input.value; $('#order-primary').dispatchEvent(new Event('change')); });
    $('#order-region').onchange = () => { region = $('#order-region').value; requestId = crypto.randomUUID(); };
    dialog.querySelectorAll('[name=languages],[name=type],[name=kind]').forEach(input => input.onchange = () => {
      capture(); selectedLanguages = keys.filter(key => key === primaryLanguage || dialog.querySelector(`[name=languages][value=${key}]`).checked);
      if (!selectedLanguages.includes(primaryLanguage)) { primaryLanguage = selectedLanguages[0] || ''; $('#order-primary').value = primaryLanguage; }
      const previousType = type;
      type = dialog.querySelector('[name=type]:checked')?.value || '';
      kind = dialog.querySelector('[name=kind]:checked')?.value || 'text';
      if (type !== previousType) { imageData = imageName = mobileImageData = mobileImageName = ''; languageImages = {}; $('[name=imageFile]').value = ''; $('[name=imageMobileFile]').value = ''; $('#order-image-name').textContent = ''; $('#order-mobile-image-name').textContent = ''; }
      requestId = crypto.randomUUID(); showFields(); calendar();
    });
    for (const [id, delta] of [['month-prev', -1], ['month-next', 1]]) $('#' + id).onclick = () => { const [year, number] = month.split('-').map(Number); month = new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7); calendar(); };
    for (const [field, mobile] of [['imageFile', false], ['imageMobileFile', true]]) {
      $(`[name=${field}]`).onchange = async event => {
        const file = event.target.files[0];
        if (mobile) { mobileImageData = ''; mobileImageName = ''; $('#order-mobile-image-name').textContent = ''; }
        else { imageData = ''; imageName = ''; $('#order-image-name').textContent = ''; }
        if (file) {
          try {
            if (mobile) { mobileImageData = await fitImage(file, 660, 300); mobileImageName = file.name; $('#order-mobile-image-name').textContent = file.name; }
            else {
              imageData = await fitImage(file, 1200, type === 'PREMIUM' ? 200 : 720); imageName = file.name; $('#order-image-name').textContent = file.name;
              if (type === 'PREMIUM' && !mobileImageName) { mobileImageData = await fitImage(file, 660, 300); $('#order-mobile-image-name').textContent = t('autoImage'); }
            }
            $('[name=imageFile]').required = false;
            $('[name=imageMobileFile]').required = false;
            setMessage('');
          } catch { setMessage('imageError'); event.target.value = ''; }
        }
        requestId = crypto.randomUUID(); summary();
      };
    }
    $('#order-form').oninput = event => {
      if (event.target.dataset.title || event.target.dataset.description) sampleLanguage = event.target.dataset.title || event.target.dataset.description;
      if (event.target.name === 'publicPhone') { const value=event.target.value.trim(); event.target.setCustomValidity(value && (!/^\+?[0-9][0-9 ().-]*$/.test(value) || (value.match(/\d/g) || []).length < 6) ? t('phoneInvalid') : ''); }
      if (event.target.name === 'url') { const value=event.target.value.trim(); let safe=!value; if(value){try{const parsed=new URL(value);safe=['https:','http:'].includes(parsed.protocol)&&Boolean(parsed.hostname)&&!parsed.username&&!parsed.password;}catch{safe=false;}} event.target.setCustomValidity(safe?'':t('urlInvalid')); }
      capture(); requestId = crypto.randomUUID(); summary(); drawExampleBanners();
    };
    $('#order-form').onsubmit = event => { event.preventDefault(); review(); };
    showFields(); calendar();
  }

  function review() {
    capture(); if ((!chosenDates.length && !(editId && !editDatesTouched && editOriginalDates.length)) || chosenDates.some(date => conflicts[date])) { setMessage('empty'); return; }
    if (selectedLanguages.some(language => !titles[language]?.trim() || !descriptions[language]?.trim() || length(titles[language]) > limits[type].title || length(descriptions[language]) > limits[type].description)) { setMessage('tooLong'); return; }
    const box = $('#order-confirm'); box.replaceChildren(node('h3', t('preview')));
    const controls = node('div', '', 'order-preview-controls');
    const preview = node('div', '', 'order-preview');
    let previewLanguage = primaryLanguage, device = 'desktop';
    function drawPreview() {
      preview.replaceChildren(); preview.classList.toggle('is-mobile', device === 'mobile');
      const item = node('article', '', type === 'PREMIUM' ? 'premium-banner__link' : 'listing-card');
      if (type === 'TOP' || type === 'PREMIUM') {
        const artwork = languageImages[previewLanguage] || {};
        const ownImage = kind === 'image' ? artwork.image || imageData : '';
        item.append(window.buildAdCreative({type,title:titles[previewLanguage],description:descriptions[previewLanguage],company,publicPhone,publicEmail,contact,image:ownImage,imageMobile:kind === 'image' ? artwork.imageMobile || mobileImageData : ''},device === 'mobile'));
        if (type === 'TOP' && ownImage) item.append(node('h3',titles[previewLanguage]),node('p',descriptions[previewLanguage]));
      } else item.append(node('h3',titles[previewLanguage]),node('p',descriptions[previewLanguage], 'listing-copy'),node('p',[company,publicPhone,publicEmail,contact].filter(Boolean).join(' · '),'listing-contact'));
      preview.append(item);
    }
    for (const language of selectedLanguages) { const button = node('button',languages[language].name,'chosen-day'); button.type = 'button'; button.onclick = () => { previewLanguage = language; drawPreview(); }; controls.append(button); }
    for (const view of ['desktop','mobile']) { const button = node('button',t(view),'chosen-day'); button.type = 'button'; button.onclick = () => { device = view; drawPreview(); }; controls.append(button); }
    box.append(controls,preview); drawPreview();
    box.append(node('h4',t('publicPreview')),node('p',[company,publicPhone,publicEmail,url,contact].filter(Boolean).join(' · ') || '—'),node('p',clickBehavior()),node('h4',t('privatePreview')),node('p',[customerName,email].filter(Boolean).join(' · ')),node('p', `${type} · ${t(kind === 'text' ? 'text' : 'banner')} · ${chosenDates.join(', ')} · ${chosenDates.length * 24} h`), node('p', $('#order-breakdown').textContent), node('strong', money(editId ? editPaymentAmount : adminMode && adminComplimentary ? 0 : total())), node('p', editId ? 'Zmiany administratora nie pobierają kolejnej płatności.' : adminMode && adminComplimentary ? 'Bezpłatne ogłoszenie administratora — bez Stripe.' : demoMode ? t('unpaid') : config.paymentsEnabled ? t('payNote') : t('paymentDisabled')));
    const back = node('button', t('back'), 'order-back'), send = node('button', editId ? 'Zapisz zmiany' : adminMode && adminComplimentary ? 'Dodaj bezpłatnie' : demoMode ? t('send') : t('pay'), 'button');
    back.type = send.type = 'button'; back.onclick = () => { $('#order-form').hidden = false; box.hidden = true; };
    send.onclick = async () => {
      if (pending) return;
      if (!editId && !(adminMode && adminComplimentary) && !demoMode && !config.paymentsEnabled) { setMessage('paymentDisabled'); return; }
      pending = true; send.disabled = back.disabled = true;
      const body = { requestId, type, kind, region, primaryLanguage, dates: editId && !editDatesTouched ? editOriginalDates : chosenDates, variants: [primaryLanguage, ...selectedLanguages.filter(language => language !== primaryLanguage)].map(language => ({ language, title: titles[language], description: descriptions[language], ...(kind === 'image' ? languageImages[language] || {} : {}) })), contact, publicPhone, publicEmail, email, company, url, customerName, image: imageData, imageMobile: type === 'PREMIUM' ? mobileImageData : '', consent: true, termsAccepted:$('#order-form').elements.termsAccepted.checked,termsVersion:'draft-2026-11-11',earlyServiceRequest:$('#order-form').elements.earlyServiceRequest.checked, expectedTotalPrice: total() };
      try {
        const result = await api(editId ? 'admin-revise-group' : adminMode && adminComplimentary ? 'admin-order-batch' : 'order-batch', {}, editId ? { ...body, id: editId, version: editVersion, adminStatus } : adminMode && adminComplimentary ? { ...body, adminComplimentary: true, adminStatus } : body);
        if (editId || adminMode && adminComplimentary) {
          window.parent.postMessage({ type: 'pbe:admin-ad-saved', id: result.id || editId, published: adminStatus === 'approved', edited: Boolean(editId) }, location.origin);
          box.replaceChildren(node('h3', editId ? 'Zmiany ogłoszenia zapisane.' : adminStatus === 'approved' ? 'Ogłoszenie zatwierdzone.' : 'Ogłoszenie zapisane do zatwierdzenia.'));
          chosenDates = []; requestId = crypto.randomUUID();
          return;
        }
        if (!result.demo) {
          sessionStorage.setItem(`pbe-order-${result.id}`, requestId);
          const checkout = await paymentApi('start', {}, { groupId: result.id, requestId });
          if (!/^https:\/\/checkout\.stripe\.com\//.test(checkout.url || '')) throw new Error('paymentUnavailable');
          (adminMode && window.top !== window ? window.top : window).location.assign(checkout.url);
          return;
        }
        box.replaceChildren(node('h3', t('demoSuccess')));
        chosenDates = []; requestId = crypto.randomUUID();
      } catch (error) {
        setMessage(({ disabled: 'unavailable', full: 'full', priceChanged: 'changed', image: 'imageError' })[error.message] || 'error');
        if (['priceChanged', 'full', 'disabled'].includes(error.message)) {
          try { config = await api('config'); } catch { /* Keep the previous quote visible. */ }
          box.hidden = true; $('#order-form').hidden = false; calendar();
        }
      } finally { pending = false; send.disabled = back.disabled = false; }
    };
    box.append(back, send); $('#order-form').hidden = true; box.hidden = false; send.focus();
  }

  async function open(trigger) {
    if (dialog.open) return;
    restoreFocus = trigger; locale = copy[document.documentElement.lang] ? document.documentElement.lang : 'pl'; selectedLanguages = [locale]; primaryLanguage = locale; sampleLanguage = locale;
    chosenDates = []; editOriginalDates = []; editDatesTouched = false; conflicts = {}; availabilityReady = false; region = 'all'; imageData = imageName = mobileImageData = mobileImageName = ''; languageImages = {}; titles = {}; descriptions = {};
    dialog.innerHTML = `<div class="order-heading"><h2 id="order-title">${t('title')}</h2></div><p>${t('loading')}</p>`;
    dialog.showModal(); document.body.classList.add('order-open');
    try {
      config = await api('config');
      if (new URLSearchParams(location.search).get('cms') === '1') {
        const check = await fetch('/api/ads?action=admin-settings', { credentials: 'same-origin', cache: 'no-store' });
        if (!check.ok) throw new Error('Administrator authentication required');
        adminMode = true;
        editId = new URLSearchParams(location.search).get('edit') || '';
        if (editId) {
          const target = await api('admin-detail', { id: editId });
          const all = (await api('admin-orders')).orders;
          const siblings = target.groupId ? all.filter(item => item.groupId === target.groupId) : [target];
          const full = await Promise.all(siblings.map(item => item.id === target.id ? target : api('admin-detail', { id: item.id })));
          primaryLanguage = target.primaryLanguage || target.language;
          selectedLanguages = full.map(item => item.language);
          const primary = full.find(item => item.language === primaryLanguage) || target;
          type = target.type; kind = target.kind; region = target.region || 'all';
          titles = Object.fromEntries(full.map(item => [item.language, item.title]));
          descriptions = Object.fromEntries(full.map(item => [item.language, item.description]));
          languageImages = Object.fromEntries(full.filter(item => item.language !== primaryLanguage).map(item => [item.language, { image: item.image || '', imageMobile: item.imageMobile || '' }]));
          imageData = primary.image || ''; mobileImageData = primary.imageMobile || '';
          imageName = imageData ? 'Obecna grafika' : ''; mobileImageName = mobileImageData ? 'Obecna grafika mobilna' : '';
          company = primary.company || ''; contact = primary.contact || ''; publicPhone = primary.publicPhone || ''; publicEmail = primary.publicEmail || ''; url = primary.url || '';
          customerName = primary.customerName || ''; email = primary.email || '';
          editOriginalDates = target.periods?.length ? target.periods.map(period => period.date) : [target.startDate];
          chosenDates = editOriginalDates.filter(date => date >= config.today);
          adminStatus = target.status; adminComplimentary = target.source === 'manual' && target.paymentStatus === 'not_required';
          editVersion = target.version; editPaymentAmount = target.groupTotalPrice ?? target.totalPrice ?? 0;
          month = chosenDates[0]?.slice(0, 7) || config.today.slice(0, 7);
        }
      }
      month = month || config.today.slice(0, 7); render(); await showPaymentResult();
    }
    catch { dialog.replaceChildren(node('p', t('error'))); const close = node('button', t('close'), 'button'); close.type = 'button'; close.onclick = () => dialog.close(); dialog.append(close); close.focus(); }
  }
  async function showPaymentResult() {
    const query = new URLSearchParams(location.search);
    const orderId = query.get('order');
    if (!['return', 'cancel'].includes(query.get('payment')) || !orderId) return;
    const token = sessionStorage.getItem(`pbe-order-${orderId}`);
    if (!token) { $('#order-message').textContent = `${t('paymentReturnUntracked')} ${orderId}`; return; }
    try {
      const result = await paymentApi('status', { id: orderId, token });
      $('#order-message').textContent = `Zamówienie ${orderId}: płatność ${result.paymentStatus}, moderacja ${result.moderationStatus}. Powrót ze Stripe nie potwierdza płatności; status aktualizuje webhook.`;
      const previous = dialog.querySelector('#payment-status-refresh'); if (previous) previous.remove();
      const refresh = node('button', 'Odśwież status', 'button'); refresh.id = 'payment-status-refresh'; refresh.type = 'button'; refresh.onclick = showPaymentResult; $('#order-message').after(refresh);
    } catch { $('#order-message').textContent = 'Nie udało się pobrać statusu płatności. Spróbuj ponownie później.'; }
  }
  document.addEventListener('click', event => { const trigger = event.target.closest('[data-order-open],a[href="/zamow-ogloszenie/"]'); if (trigger) { event.preventDefault(); open(trigger); } });
  dialog.addEventListener('close', () => { capture(); version++; document.body.classList.remove('order-open'); restoreFocus?.focus(); });
  document.addEventListener('languagechange', () => { if (dialog.open && config) { capture(); locale = copy[document.documentElement.lang] ? document.documentElement.lang : 'pl'; render(); } });
  if (location.pathname === '/zamow-ogloszenie/') open(document.querySelector('[data-order-open]'));
})();
