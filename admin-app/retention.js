import { cmsRequest } from './modules/client.js';
import { escapeHtml } from './ui.js';

const preview = document.querySelector('#retention-preview');
const runs = document.querySelector('#retention-runs');
const contacts = document.querySelector('#retention-contacts');
const notice = document.querySelector('#retention-notice');
const labels = { contact:'Wiadomości kontaktowe', ai_history:'Historia rozmów AI', sessions:'Wygasłe sesje', security_logs:'Logi bezpieczeństwa', unpaid_orders:'Nieopłacone zamówienia', paid_orders:'Opłacone zamówienia' };
const format = value => value ? new Date(value).toLocaleString('pl-PL') : '—';

async function load() {
  notice.textContent='Pobieranie podglądu…';
  try {
    const [data,inbox] = await Promise.all([cmsRequest('retention'),cmsRequest('contact')]);
    preview.innerHTML=`<table><thead><tr><th>Kategoria</th><th>Okres TEST</th><th>Kwalifikujące się</th></tr></thead><tbody>${Object.entries(labels).map(([key,label])=>`<tr><td>${label}</td><td>${data.policy[key] === null ? 'Wyłączone' : `${data.policy[key]} dni`}</td><td>${Number(data.counts[key] || 0)}</td></tr>`).join('')}</tbody></table>`;
    runs.innerHTML=data.runs.length?`<table><thead><tr><th>Rozpoczęcie</th><th>Stan</th><th>Usunięte</th><th>Błąd</th></tr></thead><tbody>${data.runs.map(run=>`<tr><td>${escapeHtml(format(run.started_at))}</td><td>${escapeHtml(run.status)}</td><td>${Object.values(JSON.parse(run.counts_json || '{}')).reduce((a,b)=>a+Number(b||0),0)}</td><td>${escapeHtml(run.error_code || '—')}</td></tr>`).join('')}</tbody></table>`:'<p>Brak uruchomień.</p>';
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
