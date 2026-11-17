import { cmsRequest } from './modules/client.js';
import { escapeHtml, confirmAction, formatDate } from './ui.js';

const history = document.querySelector('#ai-chat-history');
const form = document.querySelector('#ai-chat-form');
const notice = document.querySelector('#ai-chat-notice');
localStorage.removeItem('ai-chat-conversation');
let conversationId = sessionStorage.getItem('ai-chat-conversation') || crypto.randomUUID();
let lastJobs = [];
const status = { queued:'Oczekuje',running:'W trakcie',done:'Gotowe',failed:'Błąd',cancelled:'Anulowane' };
const errorText = { official_source_url_required:'Podany adres źródła musi być oficjalnym adresem HTTPS.', official_source_not_found:'Nie udało się ustalić adresu urzędowego. Dodaj link HTTPS i ponów zadanie.', source_discovery_invalid:'Odpowiedź wyszukiwania źródła była niepoprawna. Ponów zadanie z linkiem urzędowym.', source_unavailable:'Nie udało się pobrać źródła.', source_not_relevant:'Źródło nie potwierdza tematu.', unsupported_article:'Wygenerowany tekst nie przeszedł kontroli źródeł.', unsupported_quote:'Cytat nie został potwierdzony w źródle.', quote_not_found:'Cytat nie został potwierdzony w źródle.', missing_quotes:'Brakuje cytatów ze źródła.', invalid_quote_shape:'Cytaty mają niepoprawny format.', invalid_article_body:'Treść wymaga ponownego przygotowania.', missing_source_link:'Brakuje linku do źródła.', gemini_unavailable:'Gemini nie jest skonfigurowany w Workerze. Skontaktuj się z administratorem.', daily_limit:'Dzienny limit zadań AI został osiągnięty.', The_operation_was_aborted_due_to_timeout:'Przekroczono czas odpowiedzi. Spróbuj ponownie.' , gemini_http_401:'Klucz Gemini został odrzucony. Sprawdź sekret Workera.', gemini_http_403:'Projekt Gemini odmówił dostępu. Sprawdź uprawnienia klucza.', gemini_http_404:'Model Gemini jest niedostępny dla tego klucza.', gemini_http_429:'Limit Gemini został osiągnięty. Spróbuj ponownie później.', gemini_http_503:'Gemini jest chwilowo niedostępny. Spróbuj ponownie później.', gemini_invalid_json:'Gemini zwrócił niepoprawną odpowiedź. Ponów zlecenie.', lease_expired:'Zadanie przekroczyło czas wykonania. Ponów zlecenie.' };
async function load() {
  try {
    const data = await cmsRequest('ai-chat');
    if (data.entries.length && !data.entries.some(entry=>entry.conversation_id===conversationId)) { conversationId = data.entries.at(-1).conversation_id; sessionStorage.setItem('ai-chat-conversation',conversationId); }
    const entries = data.entries.filter(entry=>entry.conversation_id===conversationId);
    lastJobs = data.jobs.filter(job=>job.conversation_id===conversationId);
    history.innerHTML = `${entries.map(entry=>`<article class="ai-chat-message ${entry.role==='admin'?'from-admin':'from-agent'}"><strong>${entry.role==='admin'?'Administrator':'AI Redaktor'}</strong><p>${escapeHtml(entry.body)}</p><small>${escapeHtml(formatDate(entry.created_at,true))} (PL/BE)</small></article>`).join('')}${lastJobs.map(job=>`<article class="ai-chat-job"><strong>Zadanie: ${status[job.status] || job.status}</strong>${job.error_code?`<p>${escapeHtml(errorText[job.error_code] || 'Zadanie nie powiodło się. Sprawdź źródło lub ponów.')}</p>`:''}${job.candidate_id?`<button class="secondary" type="button" data-open-article="${escapeHtml(job.candidate_id)}">Otwórz artykuł</button>`:''}${job.status==='failed' && job.attempts<3?`<button class="secondary" type="button" data-retry="${escapeHtml(job.id)}">Ponów</button>`:''}</article>`).join('')}` || '<p class="empty-state">Rozpocznij rozmowę z agentem.</p>';
    history.scrollTop = history.scrollHeight;
  } catch (error) { notice.textContent = error.message; }
}
form.addEventListener('submit',async event=>{
  event.preventDefault(); const button = form.querySelector('button[type=submit]'); if(button.disabled)return;
  button.disabled=true; notice.textContent='Wysyłanie…';
  try {
    const payload=await cmsRequest('ai-chat',{},'POST',{action:'send',mode:form.elements.mode.value,text:form.elements.text.value.trim(),conversationId});
    conversationId=payload.conversationId; sessionStorage.setItem('ai-chat-conversation',conversationId); form.elements.text.value='';
    notice.textContent=payload.jobId?'Zadanie zapisano w kolejce.':'Odpowiedź zapisana.'; await load();
  } catch(error){notice.textContent=error.message;} finally{button.disabled=false;}
});
history.addEventListener('click',async event=>{
  const open=event.target.closest('[data-open-article]');
  if(open){document.dispatchEvent(new CustomEvent('cms:open-ai',{detail:open.dataset.openArticle}));return;}
  const retry=event.target.closest('[data-retry]');if(!retry)return;
  retry.disabled=true;try{await cmsRequest('ai-chat',{},'POST',{action:'retry',jobId:retry.dataset.retry});await load();notice.textContent='Zadanie ponownie zapisano w kolejce.';}catch(error){notice.textContent=error.message;}finally{retry.disabled=false;}
});
document.querySelector('[data-view="ai-editor"]').addEventListener('click',load);
document.querySelector('#ai-chat-clear').addEventListener('click',async () => {
  if (!await confirmAction('Wyczyścić rozmowę?', 'Historia tej rozmowy i zakończone zadania zostaną usunięte. Utworzone artykuły pozostaną w kolejce.', 'Wyczyść')) return;
  try { await cmsRequest('ai-chat',{},'POST',{action:'clear',conversationId}); sessionStorage.removeItem('ai-chat-conversation'); conversationId=crypto.randomUUID(); lastJobs=[]; await load(); notice.textContent='Rozmowę wyczyszczono.'; }
  catch(error){notice.textContent=error.message;}
});
document.addEventListener('cms:load-ai',load);
setInterval(()=>{if(!document.hidden && document.querySelector('[data-panel="ai-editor"]:not([hidden])') && lastJobs.some(job=>['queued','running'].includes(job.status)))load();},10000);
