const messages = {
  unauthorized: 'Sesja wygasła. Zaloguj się ponownie.', invalidCredentials: 'Nieprawidłowy e-mail lub hasło.', forbidden: 'Nie masz uprawnień do tej operacji.',
  passwordChangeRequired: 'Zmień hasło tymczasowe przed rozpoczęciem pracy.', passwordLength: 'Hasło musi mieć od 15 do 128 znaków.', passwordReuse: 'Nowe hasło musi różnić się od dotychczasowego.',
  rateLimit: 'Zbyt wiele prób. Spróbuj ponownie za 15 minut.', validation: 'Sprawdź dane formularza.', emailExists: 'Konto z tym adresem e-mail już istnieje.',
  lastAdmin: 'Musi pozostać co najmniej jeden aktywny administrator.', selfModification: 'Własne hasło zmień przez „Zmień hasło”. Nie możesz odebrać sobie dostępu administratora.',
  conflict: 'Dane zmieniły się. Odśwież widok i spróbuj ponownie.', origin: 'Nieprawidłowy adres panelu. Otwórz go pod skonfigurowaną domeną.',
  unavailable: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.', configuration: 'Logowanie nie zostało skonfigurowane. Skontaktuj się z administratorem.',
  contentConfiguration: 'Publikowanie treści nie zostało skonfigurowane na serwerze.', contentUnavailable: 'Nie udało się połączyć z magazynem treści.',
  path: 'Nie można edytować tego pliku.', notFound: 'Nie znaleziono danych.', tooLarge: 'Plik jest za duży.', image: 'Wybierz poprawny plik obrazu.', templateCode: 'Treść nie może zawierać kodu szablonów.'
};
export async function cmsRequest(endpoint, params = {}, method = 'GET', body) {
  let response;
  try { response = await fetch(`/.netlify/functions/${endpoint}?${new URLSearchParams(params)}`, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body === undefined || ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(body) }); }
  catch { throw new Error(messages.unavailable); }
  const payload = await response.json().catch(() => ({ error: 'unavailable' }));
  if (!response.ok) {
    if (payload.error === 'unauthorized' || payload.error === 'passwordChangeRequired') document.dispatchEvent(new CustomEvent('cms-session-required', { detail: payload.error }));
    const error = new Error(messages[payload.error] || payload.message || messages.unavailable);
    error.status = response.status; error.code = payload.error; error.details = payload.details; throw error;
  }
  return payload;
}
