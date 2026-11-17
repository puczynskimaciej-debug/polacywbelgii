import { cmsRequest } from './modules/client.js';
import { escapeHtml } from './ui.js';

const preview = document.querySelector('#retention-preview');
const runs = document.querySelector('#retention-runs');
const contacts = document.querySelector('#retention-contacts');
const securityHolds = document.querySelector('#security-holds');
const securityHoldForm = document.querySelector('#security-hold-form');
const notice = document.querySelector('#retention-notice');
const labels = { contact:'Wiadomości kontaktowe', ai_history:'Historia rozmów AI', sessions:'Wygasłe sesje', security_logs:'Logi bezpieczeństwa', unpaid_orders:'Nieopłacone zamówienia', paid_orders:'Opłacone zamówienia' };
const format = value => value ? new Intl.DateTimeFormat('pl-PL',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Brussels'}).format(new Date(value)) : '—';

async function load() {
  notice.textContent='Pobieranie podglądu…';
  try {
    const [data,inbox] = await Promise.all([cmsRequest('retention'),cmsRequest('contact')]);
    preview.innerHTML=`<table><thead><tr><th>Kategoria</th><th>Okres TEST</th><th>Kwalifikujące się</th></tr></thead><tbody>${Object.entries(labels).map(([key,label])=>`<tr><td>${label}</td><td>${data.policy[key] === null ? 'Wyłączone' : `${data.policy[key]} dni`}</td><td>${Number(data.counts[key] || 0)}</td></tr>`).join('')}</tbody></table>`;
    runs.innerHTML=data.runs.length?`<table><thead><tr><th>Rozpoczęcie</th><th>Stan</th><th>Usunięte</th><th>Błąd</th></tr></thead><tbody>${data.runs.map(run=>`<tr><td>${escapeHtml(format(run.started_at))}</td><td>${escapeHtml(run.status)}</td><td>${Object.values(JSON.parse(run.counts_json || '{}')).reduce((a,b)=>a+Number(b||0),0)}</td><td>${escapeHtml(run.error_code || '—')}</td></tr>`).join('')}</tbody></table>`:'<p>Brak uruchomień.</p>';
    securityHolds.innerHTML=data.securityHolds.length?`<div class="table-scroll"><table><thead><tr><th>Powód</th><th>Od</th><th>Do</th><th>Działanie</th></tr></thead><tbody>${data.securityHolds.map(hold=>`<tr><td>${escapeHtml(hold.reason_code==='incident'?'Incydent':'Dowody prawne')}</td><td>${escapeHtml(format(hold.start_at))}</td><td>${escapeHtml(format(hold.end_at))}</td><td><button type="button" class="secondary" data-release-security-hold="${escapeHtml(hold.id)}">Zwolnij blokadę</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Brak aktywnych blokad logów.</p>';
    contacts.innerHTML=inbox.messages.length?`<div class="table-scroll"><table><thead><tr><th>Data</th><th>Sprawa</th><th>Status</th><th>Działania</th></tr></thead><tbody>${inbox.messages.map(item=>`<tr><td>${escapeHtml(format(item.created_at))}</td><td>${escapeHtml(item.subject)}</td><td>${item.closed_at?`Zamknięta ${escapeHtml(format(item.closed_at))}`:'Otwarta'}${item.hold_reason?` · blokada: ${escapeHtml(item.hold_reason)}`:''}</td><td><button type="button" class="secondary" data-retention-action="${item.closed_at?'reopen-contact':'close-contact'}" data-id="${escapeHtml(item.id)}">${item.closed_at?'Otwórz':'Zamknij'}</button> <button type="button" class="secondary" data-retention-action="${item.hold_reason?'release-hold':'hold'}" data-id="${escapeHtml(item.id)}">${item.hold_reason?'Zwolnij blokadę':'Zablokuj usuwanie'}</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Brak wiadomości.</p>';
    notice.textContent='Podgląd nie zmienia danych.';
  } catch(error) { notice.textContent=error.message; }
}

document.querySelector('.nav-item[data-view="retention"]').addEventListener('click',load);
document.querySelector('#retention-refresh').addEventListener('click',load);
contacts.addEventListener('click',async event=>{
  const button=event.target.closest('[data-retention-action]');
  if(!button) return;
  const action=button.dataset.retentionAction;
  if((action==='close-contact' || action==='release-hold') && !confirm(action==='close-contact'?'Czy sprawa jest zakończona i można rozpocząć okres retencji?':'Czy blokada prawna rzeczywiście ustała?')) return;
  button.disabled=true;
  try {
    await cmsRequest('retention',{},'POST',action==='hold'||action==='release-hold'?{action,entityType:'contact',entityId:button.dataset.id,...(action==='hold'?{reasonCode:'open_case'}:{})}:{action,id:button.dataset.id});
    await load();
  } catch(error) { notice.textContent=error.message; button.disabled=false; }
});

securityHoldForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const input=new FormData(securityHoldForm);
  const start=input.get('startAt');
  const end=input.get('endAt');
  if(!start || end && end<start){ notice.textContent='Sprawdź zakres dat.'; return; }
  const button=securityHoldForm.querySelector('button[type="submit"]');
  button.disabled=true;
  try {
    await cmsRequest('retention',{},'POST',{action:'hold-security-logs',reasonCode:input.get('reasonCode'),startAt:new Date(start).toISOString(),...(end?{endAt:new Date(end).toISOString()}:{})});
    securityHoldForm.reset();
    await load();
  } catch(error) { notice.textContent=error.message; }
  finally { button.disabled=false; }
});
securityHolds.addEventListener('click',async event=>{
  const button=event.target.closest('[data-release-security-hold]');
  if(!button || !confirm('Czy incydent i obowiązek zachowania dowodów zakończyły się?')) return;
  button.disabled=true;
  try { await cmsRequest('retention',{},'POST',{action:'release-security-hold',id:button.dataset.releaseSecurityHold}); await load(); }
  catch(error) { notice.textContent=error.message; button.disabled=false; }
});
