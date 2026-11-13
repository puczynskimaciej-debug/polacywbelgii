import { cmsRequest } from './modules/client.js';
import { escapeHtml, formatDate, renderMarkdown, confirmAction, enableTabKeyboard } from './ui.js';

const $ = selector => document.querySelector(selector);
const statusNames = { draft:'Szkic',pending_review:'Do zatwierdzenia',changes_requested:'Wymaga poprawek',approved:'Zaakceptowany',scheduled:'Zaplanowany',published:'Opublikowany',rejected:'Odrzucony',archived:'Wycofany' };
const verifyNames = { verified:'Zweryfikowano',needs_review:'Wymaga sprawdzenia',unverified:'Niezweryfikowano' };
const issueName = issue => issue === 'AI-generated text requires claim-by-claim editorial review' ? 'Sprawdź każde twierdzenie z podanymi źródłami przed akceptacją.' : issue;
const badge = status => `<span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusNames[status] || 'Nieznany')}</span>`;
const parse = (value,fallback) => { try { return JSON.parse(value || '') || fallback; } catch { return fallback; } };
const localParts = value => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(' ','T');
let data = { candidates:[],sources:[],runs:[],history:[],config:{},canManage:false };
let selected = null;
const item = id => data.candidates.find(row => row.id === id);
const notice = text => { $('#ai-notice').textContent = text; };

function renderQueue() {
  const rows = data.candidates.filter(row => row.owner_kind === 'agent');
  const overdue = rows.filter(row => row.overdue);
  $('#ai-publication-status').textContent = data.publicationMode === 'manual_local' ? 'Publikator lokalny wymaga ręcznego uruchomienia. Zaplanowany termin nie uruchamia publikacji samoczynnie.' : 'Publikator Cron wymaga osobnej konfiguracji i wdrożenia.';
  $('#ai-overdue').hidden = !overdue.length;
  $('#ai-overdue').textContent = overdue.length ? `${overdue.length} materiałów: Termin publikacji minął — materiał nie został opublikowany. Otwórz materiał i sprawdź blokadę.` : '';
  const pending = rows.filter(row => row.status === 'pending_review').length;
  $('#ai-drafts').textContent = pending;
  $('#ai-scheduled').textContent = rows.filter(row => row.status === 'scheduled').length;
  $('#ai-published').textContent = rows.filter(row => row.status === 'published').length;
  $('#topbar-alert-count').textContent = pending;
  $('#ai-found').textContent = data.runs[0]?.found ?? 0;
  $('#ai-events').textContent = rows.filter(row => row.kind === 'event').length;
  $('#ai-errors').textContent = parse(data.runs[0]?.errors_json,[]).length;
  $('#ai-cost').textContent = Number(data.costUsd || 0).toFixed(2);
  $('#ai-sources').innerHTML=data.sources.length?data.sources.map(source=>`<div class="repeat-item"><strong>${escapeHtml(source.id)}</strong><p>${escapeHtml(source.url)}</p>${data.canManage?`<button class="secondary" type="button" data-source-id="${escapeHtml(source.id)}" data-active="${source.active?0:1}">${source.active?'Wyłącz':'Włącz'}</button>`:''}</div>`).join(''):'<p class="empty-state">Brak źródeł.</p>';
  for(const key of ['dailyTarget','dailyMax','bufferDays','maxPending']) $('#ai-config').elements[key].value=data.config[key]||'';
  $('#ai-config').elements.slots.value=(data.config.slots||[]).join(', ');
  document.dispatchEvent(new CustomEvent('cms:ai-data',{detail:data}));
}

function showTab(name) {
  document.querySelectorAll('[data-ai-tab]').forEach(tab=>{tab.classList.toggle('is-active',tab.dataset.aiTab===name);tab.setAttribute('aria-selected',String(tab.dataset.aiTab===name));});
  document.querySelectorAll('[data-ai-panel]').forEach(panel=>panel.hidden=panel.dataset.aiPanel!==name);
}
function renderDetail() {
  if(!selected)return;
  selected=item(selected.id)||selected;
  const row=selected, verification=parse(row.verification_json,{}), sources=parse(row.sources_json,[]), tags=parse(row.tags_json,[]);
  $('#ai-detail-title').textContent=row.kind==='event'?'Szczegóły wydarzenia':'Szczegóły artykułu';
  $('[data-ai-panel=preview]').innerHTML=`<h1>${escapeHtml(row.title || 'Wydarzenie bez tytułu')}</h1><p class="preview-description">${escapeHtml(row.description||'')}</p>${renderMarkdown(row.body)}`;
  for(const key of ['title','description','body']) $('#ai-edit-form').elements[key].value=row[key]||'';
  $('#ai-detail-meta').innerHTML=`${row.overdue?'<p role="alert">Termin publikacji minął — materiał nie został opublikowany.</p>':''}${row.publicationBlock==='verification_required'?'<p>Blokada: treść i źródła wymagają weryfikacji.</p>':''}<dl><dt>Status</dt><dd>${badge(row.status)}</dd><dt>Autor</dt><dd>${row.owner_kind==='agent'?'AI Redaktor':'Redakcja'}</dd><dt>Utworzono</dt><dd>${escapeHtml(formatDate(row.created_at,true))}</dd><dt>Proponowany termin</dt><dd>${escapeHtml(formatDate(row.proposed_publish_at,true))}</dd><dt>Weryfikacja</dt><dd>${escapeHtml(verifyNames[verification.status]||'Do sprawdzenia')}</dd><dt>Kategoria</dt><dd>${escapeHtml(row.category||'Bez kategorii')}</dd><dt>Region</dt><dd>${escapeHtml(({all:'Cała Belgia',flanders:'Flandria',wallonia:'Walonia',brussels:'Bruksela'})[row.region]||row.region||'Cała Belgia')}</dd>${tags.length?`<dt>Tagi</dt><dd>${tags.map(tag=>escapeHtml(tag)).join(', ')}</dd>`:''}</dl>`;
  $('#ai-detail-sources').innerHTML=`<h3>Źródła</h3>${sources.length?`<ul class="source-list">${sources.filter(source=>/^https:\/\//.test(source.url||'')).map(source=>`<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a></li>`).join('')}</ul>`:'<p class="empty-state">Brak źródeł.</p>'}<h3>Weryfikacja</h3><p>${escapeHtml(verifyNames[verification.status]||'Do sprawdzenia')}</p>${verification.issues?.length?`<ul>${verification.issues.map(issue=>`<li>${escapeHtml(issueName(issue))}</li>`).join('')}</ul>`:''}`;
  const history=data.history.filter(entry=>entry.candidate_id===row.id);
  $('#ai-detail-history').innerHTML=`<h3>Historia decyzji</h3><div class="history-list">${history.length?history.map(entry=>`<article><strong>${escapeHtml(statusNames[entry.new_status]||'Zmiana')}</strong><small>${escapeHtml(formatDate(entry.at,true))} · ${entry.actor_id==='agent'?'AI Redaktor':'Administrator'}</small></article>`).join(''):'<p class="empty-state">Brak historii.</p>'}</div>`;
  const primary=[],extra=[];
  if(row.status==='pending_review')primary.push(['Akceptuj','approved'],['Akceptuj i zaplanuj','schedule'],['Poproś o poprawki','changes_requested']);
  if(['approved','scheduled'].includes(row.status))primary.push(['Opublikuj teraz','publish-now'],['Zaplanuj / zmień termin','schedule']);
  if(row.status==='draft')extra.push(['Do sprawdzenia','pending_review']);
  if(row.status==='scheduled')extra.push(['Anuluj termin','approved']);
  if(['approved','scheduled'].includes(row.status))extra.push(['Cofnij zatwierdzenie','pending_review']);
  if(['draft','pending_review','changes_requested','approved','scheduled'].includes(row.status))extra.push(['Odrzuć','rejected']);
  if(row.status==='published')extra.push(['Wycofaj publikację','archived']);
  if(row.kind==='article' && verification.status!=='verified' && ['pending_review','approved','scheduled'].includes(row.status))extra.push(['Potwierdź weryfikację','verify-article']);
  if(row.overdue && verification.status==='verified' && row.approved_by && row.approved_at)primary.push(['Ponów publikację','retry-publication']);
  $('#ai-detail-actions').innerHTML=`${primary.map(([label,action],i)=>`<button type="button" class="${i===0?'primary':'secondary'}" data-ai-action="${action}">${label}</button>`).join('')}${extra.length?`<details class="action-menu"><summary>Więcej działań</summary><div>${extra.map(([label,action])=>`<button type="button" data-ai-action="${action}">${label}</button>`).join('')}</div></details>`:''}`;
}
function openDetail(row){if(!row)return;selected=row;renderDetail();showTab('preview');$('#ai-detail-dialog').showModal();}
document.addEventListener('cms:open-ai',event=>openDetail(item(event.detail)));
async function load(){notice('Ładowanie kolejki…');try{data=await cmsRequest('ai-editor');renderQueue();renderCalendar();if(selected)renderDetail();notice('');}catch(error){notice(`Nie udało się wczytać kolejki: ${error.message}`);}}
async function changeStatus(status,extra={}){try{await cmsRequest('ai-editor',{},'POST',{action:'status',id:selected.id,status,...extra});await load();notice('Decyzja została zapisana.');}catch(error){notice(error.message);}}

function matches(local){const base=Date.parse(`${local}:00Z`);if(!Number.isFinite(base))return [];return [1,2].map(hour=>new Date(base-hour*3600000)).filter(date=>localParts(date)===local);}
function schedule(){const value=selected.scheduled_at||selected.proposed_publish_at||new Date(Date.now()+86400000).toISOString(),local=localParts(value),form=$('#ai-schedule-form');form.elements.date.value=local.slice(0,10);form.elements.time.value=local.slice(11,16);$('#ai-schedule-proposal').textContent=formatDate(selected.proposed_publish_at,true);$('#ai-schedule-error').textContent='';availability();$('#ai-schedule-dialog').showModal();}
function availability(){const form=$('#ai-schedule-form'),local=`${form.elements.date.value}T${form.elements.time.value}`,found=matches(local),day=data.candidates.filter(row=>row.id!==selected?.id&&row.scheduled_at&&localParts(row.scheduled_at).slice(0,10)===form.elements.date.value),occupied=day.some(row=>localParts(row.scheduled_at)===local);$('#ai-fold-label').hidden=found.length!==2;$('#ai-schedule-availability').textContent=`${day.length} zaplanowanych publikacji tego dnia.${occupied?' Ta godzina jest już zajęta.':''}${found.length===0?' Ta godzina nie istnieje w Brukseli z powodu zmiany czasu.':''}${found.length===2?' Wybierz pierwsze lub drugie wystąpienie godziny.':''}`;return{found,occupied,local};}
function renderCalendar(){const host=$('#ai-calendar-list'),view=$('#ai-calendar-view').value,start=$('#ai-calendar-start');if(!start.value)start.value=localParts(new Date()).slice(0,10);const chosen=start.value,date=new Date(`${chosen}T12:00:00Z`);if(view==='month')date.setUTCDate(1);if(view!=='list')date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));const days=view==='week'?7:view==='month'?42:90,entries=data.candidates.filter(row=>row.scheduled_at),blocks=Array.from({length:days},(_,index)=>{const day=new Date(date);day.setUTCDate(day.getUTCDate()+index);const key=day.toISOString().slice(0,10);return{key,items:entries.filter(row=>localParts(row.scheduled_at).slice(0,10)===key),outside:view==='month'&&key.slice(0,7)!==chosen.slice(0,7)};});if(view==='list'){host.innerHTML=`<div class="calendar-list">${blocks.filter(day=>day.items.length).map(day=>`<div class="compact-item"><strong>${day.key} · ${day.items.length}</strong><span>${day.items.map(row=>`<button type="button" class="text-button" data-ai-open="${row.id}">${escapeHtml(row.title)} · ${escapeHtml(statusNames[row.status])}</button>`).join('')}</span></div>`).join('')||'<p class="empty-state">Brak publikacji w wybranym okresie.</p>'}</div>`;return;}host.innerHTML=`<div class="calendar-grid">${['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'].map(day=>`<div class="calendar-weekday">${day}</div>`).join('')}${blocks.map(day=>`<div class="calendar-day${day.outside?' is-outside':''}"><strong>${Number(day.key.slice(8))}</strong><small>${day.items.length||''}</small>${day.items.map(row=>`<button type="button" class="calendar-entry status-${escapeHtml(row.status)}" data-ai-open="${row.id}" title="${escapeHtml(row.title)}">${escapeHtml(row.title)}</button>`).join('')}</div>`).join('')}</div>`;}

$('#ai-calendar-list').addEventListener('click',event=>{const button=event.target.closest('[data-ai-open]');if(button)openDetail(item(button.dataset.aiOpen));});
document.querySelectorAll('[data-ai-tab]').forEach(tab=>tab.addEventListener('click',()=>showTab(tab.dataset.aiTab)));
enableTabKeyboard($('.detail-tabs'));
$('#ai-detail-actions').addEventListener('click',async event=>{const action=event.target.closest('[data-ai-action]')?.dataset.aiAction;if(!action)return;if(action==='schedule')return schedule();if(action==='verify-article'){ $('#ai-verify-form').reset(); $('#ai-verify-error').textContent=''; $('#ai-verify-dialog').showModal(); return; }if(action==='retry-publication'){try{await cmsRequest('ai-editor',{},'POST',{action:'retry-publication',id:selected.id});await load();notice('Publikację ponowiono.');}catch(error){notice(error.message);}return;}if(['rejected','archived','pending_review'].includes(action)&&!await confirmAction(action==='archived'?'Wycofać publikację?':action==='rejected'?'Odrzucić materiał?':'Cofnąć zatwierdzenie?',action==='archived'?'Materiał zniknie po aktualizacji strony.':'Decyzja zostanie zapisana w historii.'))return;if(action==='publish-now'){if(selected.kind==='event'){try{await cmsRequest('ai-editor',{},'POST',{action:'publish-event',id:selected.id});await load();notice('Wydarzenie opublikowane.');}catch(error){notice(error.message);}return;}if(parse(selected.verification_json,{}).status!=='verified'){notice('Przed publikacją sprawdź informacje i źródła. Użyj przycisku „Potwierdź weryfikację”.');return;}try{await cmsRequest('ai-editor',{},'POST',{action:'publish-now',id:selected.id});await load();notice('Artykuł opublikowany.');}catch(error){notice(error.message);}return;}await changeStatus(action);});
$('#ai-verify-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;try{await cmsRequest('ai-editor',{},'POST',{action:'verify-article',id:selected.id,confirmed:form.elements.confirmed.checked,note:form.elements.note.value});await load();$('#ai-verify-dialog').close();notice('Weryfikacja zapisana w historii.');}catch(error){$('#ai-verify-error').textContent=error.message;}});
$('#ai-edit-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;try{await cmsRequest('ai-editor',{},'POST',{action:'edit',id:selected.id,title:form.elements.title.value.trim(),description:form.elements.description.value.trim(),body:form.elements.body.value.trim(),category:selected.category,region:selected.region,sources:parse(selected.sources_json,[]),...(selected.kind === 'event' ? {event:parse(selected.event_json,{})} : {})});await load();showTab('preview');$('#ai-edit-error').textContent='';notice('Poprawki zapisane.');}catch(error){$('#ai-edit-error').textContent=error.message;}});
$('#ai-schedule-form').addEventListener('input',availability);
$('#ai-schedule-form').addEventListener('submit',async event=>{event.preventDefault();const{found,occupied,local}=availability(),error=$('#ai-schedule-error');if(!found.length||occupied||found[0]<=new Date()){error.textContent=!found.length?'Wybrana godzina nie istnieje w Brukseli.':occupied?'Ten termin jest zajęty.':'Wybierz przyszły termin.';return;}const fold=found.length===2?event.currentTarget.elements.fold.value:undefined;try{await cmsRequest('ai-editor',{},'POST',{action:'status',id:selected.id,status:'scheduled',localTime:local,...(fold?{fold}:{})});$('#ai-schedule-dialog').close();await load();notice('Harmonogram został zapisany.');}catch(e){error.textContent=e.message;}});
$('#ai-sources').addEventListener('click',async event=>{const button=event.target.closest('[data-source-id]');if(!button)return;try{await cmsRequest('ai-editor',{},'POST',{action:'source',id:button.dataset.sourceId,active:button.dataset.active==='1'});await load();}catch(error){notice(error.message);}});
$('#ai-config').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,config=Object.fromEntries(['dailyTarget','dailyMax','bufferDays','maxPending'].map(key=>[key,Number(form.elements[key].value)]));config.slots=form.elements.slots.value.split(',').map(value=>value.trim()).filter(Boolean);try{await cmsRequest('ai-editor',{},'POST',{action:'config',config});await load();notice('Ustawienia zostały zapisane.');}catch(error){notice(error.message);}});
$('#ai-refresh').addEventListener('click',load);for(const view of ['ai-editor','ai-calendar'])document.querySelector(`[data-view=${view}]`).addEventListener('click',load);
document.addEventListener('cms:load-ai',load);
for(const selector of ['#ai-calendar-view','#ai-calendar-start'])$(selector).addEventListener('change',renderCalendar);
$('#ai-calendar-today').addEventListener('click',()=>{$('#ai-calendar-start').value=localParts(new Date()).slice(0,10);renderCalendar();});
$('#topbar-alert').addEventListener('click',()=>document.querySelector('[data-view=dashboard]').click());
document.querySelectorAll('#ai-detail-dialog [data-close],#ai-schedule-dialog [data-close],#ai-verify-dialog [data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
