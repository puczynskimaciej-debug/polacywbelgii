import { cmsRequest } from './modules/client.js';
import { escapeHtml, confirmAction, formatDate, renderMarkdown } from './ui.js';

const card=document.querySelector('.ai-chat');
card.innerHTML=`<div class="ai-workspace">
  <aside class="ai-topics"><div class="card-heading"><h2>Tematy</h2><button id="ai-new-topic" class="secondary" type="button">Nowy temat</button></div><div id="ai-conversations"></div></aside>
  <div class="ai-thread"><div class="card-heading"><div><h2>Rozmowa z redaktorem</h2><p>Artykuły wymagają Twojej weryfikacji przed publikacją.</p></div><button id="ai-chat-clear" class="secondary" type="button">Usuń rozmowę</button></div>
    <div id="ai-chat-history" class="ai-chat-history" aria-live="polite"></div>
    <section id="ai-article-workspace" class="ai-article-workspace" hidden><div class="card-heading"><h3>Aktualny artykuł</h3><label>Wersja <select id="ai-version"></select></label></div><div id="ai-article-preview" class="article-preview"></div><div class="row-actions"><button id="ai-save-draft" class="primary" type="button">Zapisz jako szkic w CMS</button><button id="ai-open-editor" class="secondary" type="button">Otwórz w edytorze</button></div></section>
    <form id="ai-chat-form"><label>Rodzaj wiadomości<select name="mode"><option value="article">Artykuł lub poprawka</option><option value="chat">Pytanie do agenta</option></select></label><label>Twoja wiadomość<textarea name="text" rows="3" maxlength="2500" required placeholder="Zadaj pytanie, zleć artykuł albo opisz poprawki do bieżącej wersji"></textarea></label><button class="primary" type="submit">Wyślij</button><p id="ai-chat-notice" role="status"></p></form>
  </div></div><label class="ai-automatic-toggle"><input id="ai-automatic" type="checkbox"> Włącz automatyczne trzy propozycje artykułów każdego ranka</label>`;
document.querySelector('[data-panel="ai-editor"] .settings-panel').hidden=true;

const $=selector=>document.querySelector(selector);
const notice=$('#ai-chat-notice');
const status={queued:'Oczekuje',running:'Przygotowywanie',done:'Gotowy do przeglądu',failed:'Błąd',cancelled:'Anulowane'};
const errorText={source_search_empty:'Nie znaleziono dostępnych materiałów dla tego tematu. Spróbuj doprecyzować zlecenie.',unsafe_source_url:'Podany adres źródła jest niedozwolony.',source_unavailable:'Nie udało się pobrać strony źródłowej.',source_not_relevant:'Znalezione materiały nie potwierdzają tematu.',missing_quotes:'Nie udało się potwierdzić informacji w źródłach.',gemini_unavailable:'Gemini nie jest skonfigurowany.',daily_limit:'Osiągnięto dzienny limit; zadanie czeka na następny dzień.',gemini_http_429:'Gemini osiągnął limit; zadanie pozostaje w kolejce.',gemini_http_401:'Klucz Gemini został odrzucony.',gemini_http_403:'Gemini odmówił dostępu.',article_not_editable:'Ten artykuł został już zatwierdzony lub opublikowany. Rozpocznij nowy temat.'};
let conversationId=sessionStorage.getItem('ai-chat-conversation')||null;
let state={conversations:[],entries:[],jobs:[],versions:[],current:null};
let chosenVersion=null;

function render() {
  $('#ai-conversations').innerHTML=state.conversations.length?state.conversations.map(row=>`<button type="button" class="ai-topic ${row.conversation_id===conversationId?'is-active':''}" data-conversation="${escapeHtml(row.conversation_id)}"><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(formatDate(row.updated_at,true))}</small></button>`).join(''):'<p class="empty-state">Nie ma jeszcze rozmów.</p>';
  const active=state.jobs.find(job=>['queued','running'].includes(job.status));
  const latest=state.jobs[0];
  $('#ai-chat-history').innerHTML=state.entries.map(entry=>`<article class="ai-chat-message ${entry.role==='admin'?'from-admin':'from-agent'}"><strong>${entry.role==='admin'?'Administrator':'AI Redaktor'}</strong><p>${escapeHtml(entry.body)}</p><small>${escapeHtml(formatDate(entry.created_at,true))}</small></article>`).join('')+(
    latest?`<div class="ai-job-state" role="status"><strong>${escapeHtml(status[latest.status]||latest.status)}</strong>${latest.error_code?` · ${escapeHtml(errorText[latest.error_code]||`Zadanie nie powiodło się: ${latest.error_code}`)}`:''}${latest.status==='failed'&&latest.attempts<3?` <button class="secondary" type="button" data-retry="${escapeHtml(latest.id)}">Ponów</button>`:''}</div>`:'');
  const versions=state.versions;
  const current=state.current;
  const shown=versions.find(row=>row.version===chosenVersion)||versions[0]||(current?{...current,version:1}:null);
  $('#ai-article-workspace').hidden=!shown;
  if(shown){
    $('#ai-version').innerHTML=versions.length?versions.map(row=>`<option value="${row.version}">Wersja ${row.version} · ${escapeHtml(formatDate(row.created_at,true))}</option>`).join(''):'<option value="1">Aktualna wersja</option>';
    $('#ai-version').value=String(shown.version);
    $('#ai-article-preview').innerHTML=`<h2>${escapeHtml(shown.title)}</h2><p class="muted">${escapeHtml(shown.description)}</p>${renderMarkdown(shown.body)}`;
    $('#ai-save-draft').hidden=current?.status==='draft'||current?.status==='published'||current?.status==='scheduled';
    $('#ai-open-editor').disabled=!current?.id;
  }
  $('#ai-automatic').checked=state.automaticEnabled===true;
  $('#ai-chat-history').scrollTop=$('#ai-chat-history').scrollHeight;
  return Boolean(active);
}

async function load() {
  try {
    state=await cmsRequest('ai-chat',conversationId?{conversationId}:{});
    conversationId=state.conversationId||conversationId;
    if(conversationId)sessionStorage.setItem('ai-chat-conversation',conversationId);
    render();
  } catch(error){notice.textContent=error.message;}
}

$('#ai-conversations').addEventListener('click',event=>{const button=event.target.closest('[data-conversation]');if(!button)return;conversationId=button.dataset.conversation;chosenVersion=null;load();});
$('#ai-new-topic').addEventListener('click',()=>{conversationId=crypto.randomUUID();sessionStorage.setItem('ai-chat-conversation',conversationId);state={...state,entries:[],jobs:[],versions:[],current:null};chosenVersion=null;render();$('#ai-chat-form').elements.text.focus();});
$('#ai-version').addEventListener('change',event=>{chosenVersion=Number(event.target.value);render();});
$('#ai-chat-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('[type=submit]');button.disabled=true;notice.textContent='Wysyłanie…';
  try {const payload=await cmsRequest('ai-chat',{},'POST',{action:'send',mode:event.currentTarget.elements.mode.value,text:event.currentTarget.elements.text.value.trim(),conversationId});conversationId=payload.conversationId;sessionStorage.setItem('ai-chat-conversation',conversationId);event.currentTarget.elements.text.value='';chosenVersion=null;notice.textContent=payload.jobId?'Zadanie czeka na przygotowanie.':'Odpowiedź zapisana.';await load();}
  catch(error){notice.textContent=error.message;}finally{button.disabled=false;}
});
$('#ai-chat-history').addEventListener('click',async event=>{const button=event.target.closest('[data-retry]');if(!button)return;button.disabled=true;try{await cmsRequest('ai-chat',{},'POST',{action:'retry',jobId:button.dataset.retry});notice.textContent='Zadanie ponowiono.';await load();}catch(error){notice.textContent=error.message;}finally{button.disabled=false;}});
$('#ai-save-draft').addEventListener('click',async()=>{try{const result=await cmsRequest('ai-chat',{},'POST',{action:'save-draft',conversationId});notice.textContent='Szkic zapisano w CMS. Publikacja wymaga odrębnej decyzji.';await load();document.dispatchEvent(new CustomEvent('cms:open-ai',{detail:result.candidateId}));}catch(error){notice.textContent=error.message;}});
$('#ai-open-editor').addEventListener('click',()=>{if(state.current?.id)document.dispatchEvent(new CustomEvent('cms:edit-ai-article',{detail:state.current.id}));});
$('#ai-automatic').addEventListener('change',async event=>{const enabled=event.target.checked;try{await cmsRequest('ai-chat',{},'POST',{action:'automatic',enabled});notice.textContent=enabled?'Automatyczne propozycje włączone.':'Automatyczne propozycje wyłączone.';}catch(error){event.target.checked=!enabled;notice.textContent=error.message;}});
$('#ai-chat-clear').addEventListener('click',async()=>{if(!conversationId||!await confirmAction('Usunąć rozmowę?','Historia wiadomości zostanie usunięta. Istniejący artykuł pozostanie w CMS.','Usuń'))return;try{await cmsRequest('ai-chat',{},'POST',{action:'clear',conversationId});conversationId=null;sessionStorage.removeItem('ai-chat-conversation');await load();notice.textContent='Rozmowę usunięto.';}catch(error){notice.textContent=error.message;}});
document.querySelector('[data-view="ai-editor"]').addEventListener('click',load);
document.addEventListener('cms:load-ai',load);
setInterval(()=>{if(!document.hidden&&document.querySelector('[data-panel="ai-editor"]:not([hidden])')&&state.jobs?.some(job=>['queued','running'].includes(job.status)))load();},10000);
