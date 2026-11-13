import { cmsConfig } from "./config.js";
import { CmsAuth } from "./modules/auth.js";
import { ContentApi } from "./modules/content-api.js";
import { ContentRepository } from "./modules/repository.js";
import { confirmAction, renderMarkdown } from './ui.js';

const state = { api: null, repository: null, user: null, isAdmin: false, home: null, homeSha: null, site: null, siteSha: null, articles: [], media: [], history: [], users: [], editingUser: null, uploadTarget: null, previewLanguage: "pl", language: "pl", homeAll: null, siteAll: null };
const auth = new CmsAuth();
const articleUi = {
  pl:{all:'Wszystkie',allStatuses:'Wszystkie statusy',editorial:'Redakcja',open:'Otwórz',edit:'Edytuj',remove:'Usuń',empty:'Brak artykułów pasujących do filtrów.',statuses:{draft:'Szkic',pending_review:'Do zatwierdzenia',changes_requested:'Wymaga poprawek',approved:'Zaakceptowany',scheduled:'Zaplanowany',published:'Opublikowany',rejected:'Odrzucony',archived:'Wycofany'}},
  en:{all:'All',allStatuses:'All statuses',editorial:'Editorial',open:'Open',edit:'Edit',remove:'Delete',empty:'No articles match these filters.',statuses:{draft:'Draft',pending_review:'Awaiting approval',changes_requested:'Changes requested',approved:'Approved',scheduled:'Scheduled',published:'Published',rejected:'Rejected',archived:'Withdrawn'}},
  nl:{all:'Alle',allStatuses:'Alle statussen',editorial:'Redactie',open:'Openen',edit:'Bewerken',remove:'Verwijderen',empty:'Geen artikelen voor deze filters.',statuses:{draft:'Concept',pending_review:'Ter goedkeuring',changes_requested:'Wijzigingen gevraagd',approved:'Goedgekeurd',scheduled:'Gepland',published:'Gepubliceerd',rejected:'Afgewezen',archived:'Ingetrokken'}},
  fr:{all:'Tous',allStatuses:'Tous les statuts',editorial:'Rédaction',open:'Ouvrir',edit:'Modifier',remove:'Supprimer',empty:'Aucun article pour ces filtres.',statuses:{draft:'Brouillon',pending_review:'À valider',changes_requested:'Modifications demandées',approved:'Approuvé',scheduled:'Planifié',published:'Publié',rejected:'Rejeté',archived:'Retiré'}}
};
let aiSnapshot = null;
let adsSnapshot = null;
const storedArticles = () => { const ids = new Set((aiSnapshot?.candidates || []).filter(item => item.kind === 'article').map(item => item.id)); return state.articles.filter(item => item.contentType !== 'event' && !(/^ai-[a-f0-9]{20}$/.test(item.slug) && ids.has(item.slug.slice(3)))); };
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

async function initialize() {
  sessionStorage.removeItem('pbe_github_token');
  sessionStorage.removeItem('pbe_oauth_state');
  try {
    showLoading();
    state.user = await auth.session();
    state.isAdmin = state.user.role === 'admin';
    if (state.user.mustChangePassword) return showPassword(true);
    state.api = new ContentApi();
    state.repository = new ContentRepository(state.api, cmsConfig.paths);
    showApp();
    switchView('dashboard');
    if (state.isAdmin) { state.users = await auth.users(); renderUsers(); }
    try { await loadContent(); $('#content-unavailable').hidden = true; $('#content-status').hidden=true; $('.dashboard-stats article:first-child small').textContent='artykuły portalu'; } catch { showContentUnavailable(); }
    if (state.isAdmin) document.dispatchEvent(new Event('cms:load-ai'));
    document.dispatchEvent(new Event('cms:load-summary'));
  } catch (error) {
    showAuth(error.code === 'unauthorized' ? '' : error.message);
  }
}

async function loadContent() {
  const [home, site, articles, media] = await Promise.all([state.repository.home(), state.repository.site(), state.repository.articles(), state.repository.media()]);
  [state.home, state.homeSha, state.site, state.siteSha, state.articles, state.media] = [home.data, home.sha, site.data, site.sha, articles, media];
  if (state.isAdmin) state.history = await state.api.commits();
  state.homeAll=state.home; state.siteAll=state.site; selectContentLanguage();
  renderAll();
}
function showContentUnavailable() {
  $('#content-unavailable').hidden=false;
  $('#content-status').hidden=false;
  $('#article-count').textContent='n/d';
  $('.dashboard-stats article:first-child small').textContent='Magazyn treści niedostępny';
  $('#history-list').innerHTML='<p class="empty-state">Historia zmian w magazynie treści jest lokalnie niedostępna.</p>';
  $('#media-grid').innerHTML='<p class="empty-state">Biblioteka mediów jest lokalnie niedostępna.</p>';
  renderDashboard();
}

function showAuth(error = "") {
  $$('dialog[open]').forEach(dialog => dialog.close());
  $('#password-view').hidden = true;
  $("#loading-view").hidden = true; $("#app-view").hidden = true; $("#auth-view").hidden = false;
  const box = $("#auth-error"); box.textContent = error; box.hidden = !error;
}
function showLoading() { $('#password-view').hidden = true; $("#auth-view").hidden = true; $("#app-view").hidden = true; $("#loading-view").hidden = false; }
function showApp() {
  $('#password-view').hidden = true;
  $("#auth-view").hidden = true; $("#loading-view").hidden = true; $("#app-view").hidden = false;
  $("#current-user").textContent = state.user.name;
  $("#repository-name").textContent = state.isAdmin ? 'Administrator' : 'Edytor';
  $$(".admin-only").forEach((element) => element.hidden = !state.isAdmin);
}
function showPassword(required = false) {
  $$('dialog[open]').forEach(dialog => dialog.close());
  $('#auth-view').hidden = $('#loading-view').hidden = $('#app-view').hidden = true;
  $('#password-view').hidden = false; $('#password-cancel').hidden = required;
  $('#password-note').textContent = required ? 'Ustaw własne hasło, aby rozpocząć pracę w panelu.' : 'Po zmianie hasła pozostałe sesje tego konta zostaną wylogowane.';
  $('#password-error').textContent = ''; $('#account-password-form').reset();
}
function notify(text, error = false) {
  const box = $("#notice"); box.textContent = text; box.className = `message${error ? " message--error" : ""}`; box.hidden = false;
  clearTimeout(notify.timer); notify.timer = setTimeout(() => box.hidden = true, 5000);
}
function renderAll() {
  $("#article-count").textContent = storedArticles().filter(item => item.status === 'published').length;
  renderHome(); renderArticles(); renderSite(); renderMedia(); renderHistory(); renderUsers();
  renderDashboard();
}
function renderDashboard() {
  const rows = aiSnapshot?.candidates || [];
  $('#article-count').textContent = storedArticles().filter(item => item.status === 'published').length + rows.filter(item => item.kind === 'article' && item.status === 'published').length;
  $('#dashboard-pending').textContent = rows.filter(item => item.status === 'pending_review').length;
  $('#dashboard-scheduled').textContent = rows.filter(item => item.status === 'scheduled').length;
  const orders = adsSnapshot?.orders || [];
  $('#dashboard-active-ads').textContent = orders.filter(item => item.effectiveStatus === 'active').length;
  $('#dashboard-orders').textContent = orders.filter(item => ['pending','pending_payment','pending_approval','payment_failed'].includes(item.effectiveStatus)).length;
  const upcoming = rows.filter(item => item.scheduled_at && ['scheduled','published'].includes(item.status)).sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at)).slice(0,4);
  $('#dashboard-upcoming').innerHTML = upcoming.length ? upcoming.map(item => `<div class="compact-item"><strong>${escapeHtml(item.title)}</strong><small>${formatDateTime(item.scheduled_at)}</small></div>`).join('') : '<p class="empty-state">Brak zaplanowanych publikacji.</p>';
  const runs = aiSnapshot?.runs || [];
  $('#dashboard-agent').innerHTML = runs.length ? runs.slice(0,4).map(run => `<div class="compact-item"><strong>${Number(run.created||0)} nowych materiałów</strong><small>${formatDateTime(run.started_at)}</small></div>`).join('') : '<p class="empty-state">Brak ostatnich działań agenta.</p>';
  const attention = orders.filter(item => ['pending','pending_payment','pending_approval','payment_failed'].includes(item.effectiveStatus)).slice(0,4);
  const orderLabels={pending:'Oczekuje',pending_payment:'Czeka na płatność',pending_approval:'Czeka na akceptację',payment_failed:'Płatność nieudana'};
  $('#dashboard-order-list').innerHTML = attention.length ? attention.map(item => `<div class="compact-item"><strong>${escapeHtml(item.title||item.company||'Zamówienie')}</strong><small>${escapeHtml(orderLabels[item.effectiveStatus]||'Wymaga obsługi')}</small></div>`).join('') : '<p class="empty-state">Brak zamówień wymagających obsługi.</p>';
  const history = aiSnapshot?.history || [];
  const statusLabels={pending_review:'Do zatwierdzenia',approved:'Zaakceptowano',scheduled:'Zaplanowano',published:'Opublikowano',rejected:'Odrzucono',archived:'Wycofano'};
  $('#dashboard-changes').innerHTML = history.length ? history.slice(0,4).map(entry => `<div class="compact-item"><strong>${escapeHtml(statusLabels[entry.new_status]||'Zmieniono status')}</strong><small>${formatDateTime(entry.at)}</small></div>`).join('') : '<p class="empty-state">Brak ostatnich zmian.</p>';
}
document.addEventListener('cms:ai-data',event => { aiSnapshot=event.detail; renderDashboard(); renderArticles(); });
document.addEventListener('cms:ads-data',event => { adsSnapshot=event.detail; renderDashboard(); });
$('#dashboard-refresh').addEventListener('click',async() => { try{await loadContent();$('#content-unavailable').hidden=true;$('#content-status').hidden=true;$('.dashboard-stats article:first-child small').textContent='artykuły portalu';}catch{showContentUnavailable();} document.dispatchEvent(new Event('cms:load-ai')); document.dispatchEvent(new Event('cms:load-summary')); switchView('dashboard'); });
function selectContentLanguage() {
  for (const key of ['home','site']) { const root=state[key+'All']; if(!root)continue; if(state.language==='pl')state[key]=root; else { root.locales ||= {}; root.locales[state.language] ||= structuredClone(Object.fromEntries(Object.entries(root).filter(([k])=>k!=='locales'))); state[key]=root.locales[state.language]; } }
}
function captureLanguageDraft() {
 if(!state.home)return;
 const form=$('#home-form'); Object.assign(state.home.hero,{eyebrow:form.eyebrow.value,title:form.title.value,description:form.description.value}); state.home.news=readRepeater('news');state.home.notices=readRepeater('notices');
 const siteForm=$('#site-form'); for(const key of ['email','area','heading','description'])state.site.contact[key]=siteForm.elements['contact.'+key].value;
 $$('[data-seo]').forEach(field=>{const [page,key]=field.dataset.seo.split('.');state.site.seo[page][key]=field.value;});
}
$('#cms-language').onchange=event=>{captureLanguageDraft();state.language=event.target.value;document.documentElement.lang=state.language;selectContentLanguage();renderAll();document.dispatchEvent(new CustomEvent('cmslanguagechange',{detail:state.language}));};
function renderHome() {
  const form = $("#home-form"); form.eyebrow.value = state.home.hero.eyebrow; form.title.value = state.home.hero.title; form.description.value = state.home.hero.description;
  state.home.news.forEach((item, index) => { item.region = state.homeAll.news[index]?.region || 'all'; });
  renderRepeater("news", state.home.news); renderRepeater("notices", state.home.notices);
}
function renderRepeater(type, items) {
  const fields = type === "news" ? [["title","Tytuł"],["category","Kategoria"],["description","Opis"],["image","Zdjęcie"],["link","Link"],["region","Region"]] : [["title","Tytuł"],["category","Kategoria"],["date","Data"],["description","Treść"],["contact","Kontakt"]];
  $(`#${type}-editor`).innerHTML = items.map((item, index) => `<div class="repeat-item" data-index="${index}"><button class="remove" type="button" data-remove="${type}">×</button>${fields.map(([key,label]) => `<label class="${key === "description" ? "wide" : ""}">${label}${key === "description" ? `<textarea data-field="${key}" rows="2">${escapeHtml(item[key] || "")}</textarea>` : key === 'region' ? `<select data-field="region">${[['all','Cała Belgia'],['flanders','Flandria'],['wallonia','Walonia'],['brussels','Region Stołeczny Brukseli']].map(([value,text]) => `<option value="${value}" ${item.region === value ? 'selected' : ''}>${text}</option>`).join('')}</select>` : `<input data-field="${key}" value="${escapeHtml(item[key] || "")}">`}</label>`).join("")}${type === "news" ? `<button class="secondary" type="button" data-news-upload="${index}">Wgraj zdjęcie</button>` : ""}</div>`).join("");
}
function readRepeater(type) { return $$(`#${type}-editor .repeat-item`).map((row) => Object.fromEntries($$("[data-field]", row).map((field) => [field.dataset.field, field.value.trim()]))); }
function renderArticles() {
  const ui=articleUi[state.language] || articleUi.pl;
  const category=$('#articles-category'), previous=category.value;
  const ai=(aiSnapshot?.candidates||[]).filter(item=>item.kind==='article');
  const manual=storedArticles();
  const categories=[...new Set([...manual,...ai].map(article=>article.category).filter(Boolean))].sort();
  category.replaceChildren(new Option(ui.all,'')); categories.forEach(value=>category.add(new Option(value,value))); category.value=categories.includes(previous)?previous:'';
  for(const option of $('#articles-status').options) option.textContent=option.value ? ui.statuses[option.value] : ui.allStatuses;
  const query=$('#articles-search').value.trim().toLocaleLowerCase('pl'), status=$('#articles-status').value;
  const matches=article=>(!query||`${article.title} ${article.category}`.toLocaleLowerCase('pl').includes(query))&&(!category.value||article.category===category.value)&&(!status||article.status===status);
  const articles=manual.filter(matches), aiArticles=ai.filter(matches);
  const manualRows=articles.map(article=>`<div class="table-row"><div><h3>${escapeHtml((state.language==='pl'?article.title:article[`title_${state.language}`])||'Brak wersji w tym języku: '+article.title)}</h3><p>${escapeHtml(article.category||'Bez kategorii')} · ${formatDate(article.date)} · ${escapeHtml(ui.statuses[article.status] || article.status)} · ${ui.editorial}</p></div><div class="row-actions"><button class="secondary" data-edit-article="${escapeHtml(article.slug)}">${ui.edit}</button><button class="ghost danger" data-delete-article="${escapeHtml(article.slug)}">${ui.remove}</button></div></div>`);
  const aiRows=aiArticles.map(article=>`<div class="table-row"><div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.category||'Bez kategorii')} · ${escapeHtml(ui.statuses[article.status]||article.status)} · AI Redaktor</p></div><div class="row-actions"><button class="secondary" data-open-ai="${article.id}">${ui.open}</button></div></div>`);
  $("#articles-list").innerHTML = [...aiRows,...manualRows].join('')||`<p class="empty-state">${ui.empty}</p>`;
}
$('#articles-search').addEventListener('input',renderArticles);
$('#articles-category').addEventListener('change',renderArticles);
$('#articles-status').addEventListener('change',renderArticles);
function renderSite() {
  const form = $("#site-form"); form.elements["contact.email"].value = state.site.contact.email; form.elements["contact.area"].value = state.site.contact.area; form.elements["contact.heading"].value = state.site.contact.heading; form.elements["contact.description"].value = state.site.contact.description;
  $("#seo-editor").innerHTML = ["home","articles","contact"].map((page) => `<fieldset><legend>${{home:"Strona główna",articles:"Artykuły",contact:"Kontakt"}[page]}</legend><label>Tytuł SEO<input data-seo="${page}.title" value="${escapeHtml(state.site.seo[page].title)}"></label><label>Opis SEO<textarea data-seo="${page}.description" rows="2">${escapeHtml(state.site.seo[page].description)}</textarea></label></fieldset>`).join("");
}
function renderMedia() {
  $("#media-grid").innerHTML = state.media.length ? state.media.map((file) => `<article class="media-card"><img src="${file.download_url}" alt=""><div><p title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p><button class="ghost danger" data-delete-media="${escapeHtml(file.path)}">Usuń</button></div></article>`).join("") : "<p>Biblioteka jest pusta.</p>";
}
function renderHistory() {
  $("#history-list").innerHTML = state.history.length ? state.history.map((item) => {
    const author = item.author?.login || item.commit.author?.name || "Nieznany użytkownik";
    const avatar = item.author?.avatar_url || "";
    return `<div class="table-row"><div><h3>${escapeHtml(item.commit.message.split("\n")[0])}</h3><div class="history-author">${avatar ? `<img class="history-avatar" src="${avatar}" alt="">` : ""}<span>${escapeHtml(author)} · ${formatDateTime(item.commit.author?.date)}</span></div></div>${item.html_url ? `<a class="commit-link" href="${escapeHtml(item.html_url)}" target="_blank" rel="noopener">${escapeHtml(item.sha.slice(0,7))} ↗</a>` : `<span class="commit-link">${escapeHtml(item.sha.slice(0,7))}</span>`}</div>`;
  }).join("") : "<p>Brak historii zmian.</p>";
}
function renderUsers() {
  if (!state.isAdmin) return;
  $("#users-list").innerHTML = state.users.map(user => `<div class="table-row"><div><h3>${escapeHtml(user.name)}</h3><p>${escapeHtml(user.email)} · ${user.role === 'admin' ? 'Administrator' : 'Edytor'} · ${user.active ? 'Aktywne' : 'Zablokowane'}${user.mustChangePassword ? ' · Wymagana zmiana hasła' : ''}</p></div><button class="secondary" data-edit-user="${escapeHtml(user.id)}">Edytuj</button></div>`).join('');
}
function openUser(user = null) {
  state.editingUser = user; const form = $('#user-form'); form.reset();
  $('#user-dialog-title').textContent = user ? 'Edytuj konto' : 'Dodaj osobę';
  for (const key of ['name', 'email', 'role']) if (user) form.elements[key].value = user[key];
  form.elements.active.value = String(user?.active ?? true);
  form.elements.password.required = !user;
  form.elements.password.disabled = user?.id === state.user.id;
  $('#user-password-note').textContent = user ? 'Pozostaw hasło puste, aby je zachować. Nowe hasło tymczasowe wyloguje użytkownika i wymusi jego zmianę.' : 'Przekaż hasło tymczasowe użytkownikowi bezpiecznym kanałem. Przy pierwszym logowaniu ustawi własne hasło.';
  $('#user-error').textContent = ''; $('#user-dialog').showModal();
}
function switchView(name) { $$(".view").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === name)); $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === (name === 'event-calendar' ? 'events-editor' : name))); $(".sidebar").classList.remove("is-open"); $('#menu-toggle').setAttribute('aria-expanded','false'); $('#topbar-section').textContent=$(`[data-panel="${name}"] h1`)?.textContent||'Panel'; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? String(value || "") : date.toLocaleDateString("pl-PL"); }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? String(value || "") : date.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }); }
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

function openArticle(article = null) {
  const form = $("#article-form"); form.reset(); $("#article-dialog-title").textContent = article ? "Edytuj artykuł" : "Nowy artykuł";
  const values = article || { date: new Date().toISOString() }; Object.entries(values).forEach(([key,value]) => { if (form.elements[key]) form.elements[key].value = key === "date" ? String(value).slice(0,16) : value || ""; });
  form.elements.status.value = article?.status || 'draft';
  form.elements.status.querySelector('[value="published"]').disabled = !state.isAdmin;
  form.slug.value = article?.slug || ""; $("#article-dialog").showModal(); document.querySelector(`[data-language-tab="${state.language}"]`).click();
}
async function uploadImage(target = null) { state.uploadTarget = target; $("#media-input").click(); }
document.addEventListener('cms:upload-event-image', event => uploadImage(event.detail));
function renderArticlePreview(language = state.previewLanguage) {
  state.previewLanguage = language;
  const form = $("#article-form");
  const suffix = language === "pl" ? "" : `_${language}`;
  const title = form.elements[`title${suffix}`]?.value.trim() || form.title.value.trim() || "Bez tytułu";
  const description = form.elements[`description${suffix}`]?.value.trim() || form.description.value.trim();
  const body = form.elements[`body${suffix}`]?.value.trim() || form.body.value.trim();
  const image = form.image.value.trim();
  $("#preview-title").textContent = title;
  $("#article-preview").innerHTML = `${image ? `<img src="${escapeHtml(image)}" alt="">` : ""}<h1>${escapeHtml(title)}</h1><p class="preview-description">${escapeHtml(description)}</p>${renderMarkdown(body)}`;
  $$("[data-preview-language]").forEach((button) => button.classList.toggle("is-active", button.dataset.previewLanguage === language));
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target; const button = event.submitter; button.disabled = true;
  try { await auth.login(form.elements.email.value, form.elements.password.value); form.elements.password.value = ''; await initialize(); }
  catch (error) { showAuth(error.message); } finally { button.disabled = false; }
});
async function logout() { try { await auth.logout(); } catch (error) { notify(error.message, true); } }
$('#logout-button').addEventListener('click', logout);
$('#password-logout').addEventListener('click', logout);
$('#change-password-button').onclick = () => showPassword(false);
$('#password-cancel').onclick = () => showApp();
$('#account-password-form').onsubmit = async event => {
  event.preventDefault(); const form = event.target; const button = event.submitter;
  if (form.elements.password.value !== form.elements.confirmPassword.value) { $('#password-error').textContent = 'Hasła nie są zgodne.'; return; }
  button.disabled = true;
  try { await auth.changePassword(form.elements.currentPassword.value, form.elements.password.value); form.reset(); await initialize(); }
  catch (error) { $('#password-error').textContent = error.message; } finally { button.disabled = false; }
};
document.addEventListener('cms-session-required', event => {
  if (event.detail === 'passwordChangeRequired') showPassword(true); else showAuth('Sesja wygasła. Zaloguj się ponownie.');
});
$("#menu-toggle").addEventListener("click", () => { const open=$(".sidebar").classList.toggle("is-open"); $('#menu-toggle').setAttribute('aria-expanded',String(open)); });
$$(".nav-item").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
$('.nav-item[data-view="articles"]').addEventListener('click',() => document.dispatchEvent(new Event('cms:load-ai')));
$$('[data-event-view]').forEach(button => button.addEventListener('click', () => { switchView(button.dataset.eventView); document.dispatchEvent(new Event('cms:load-events')); }));
document.querySelectorAll('.dashboard-grid [data-view]').forEach(button=>button.addEventListener('click',()=>document.querySelector(`.nav-item[data-view="${button.dataset.view}"]`).click()));
$$("[data-language-tab]").forEach((button) => button.addEventListener("click", () => { $$("[data-language-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button)); $$("[data-language-pane]").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.languagePane === button.dataset.languageTab)); }));

$("#home-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; setBusy(button, true);
  try { Object.assign(state.home, { hero: { eyebrow: event.target.eyebrow.value.trim(), title: event.target.title.value.trim(), description: event.target.description.value.trim() }, news: readRepeater("news"), notices: readRepeater("notices") }); state.home.news.forEach((item, index) => { if (state.homeAll.news[index]) state.homeAll.news[index].region = item.region; }); const result = await state.repository.saveHome(state.homeAll, state.homeSha); state.homeSha = result.content.sha; notify("Zapisano w magazynie D1."); renderAll(); } catch(error) { notify(error.message,true); } finally { setBusy(button,false); }
});
$("#site-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; setBusy(button,true);
  try { state.site.contact = { email:event.target.elements["contact.email"].value.trim(), area:event.target.elements["contact.area"].value.trim(), heading:event.target.elements["contact.heading"].value.trim(), description:event.target.elements["contact.description"].value.trim() }; $$("[data-seo]").forEach((field) => { const [page,key]=field.dataset.seo.split("."); state.site.seo[page][key]=field.value.trim(); }); const result=await state.repository.saveSite(state.siteAll,state.siteSha); state.siteSha=result.content.sha; notify("Ustawienia kontaktu i SEO zapisane."); } catch(error){notify(error.message,true);} finally{setBusy(button,false);}
});
$("#article-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button=event.submitter; setBusy(button,true); const values=formData(event.target); values.contentType='article'; const original=state.articles.find((article)=>article.slug===values.slug);
  try { await state.repository.saveArticle(values,original); $("#article-dialog").close(); state.articles=await state.repository.articles(); renderAll(); notify(values.status === 'published' ? "Artykuł opublikowany w D1." : "Szkic zapisany w D1."); } catch(error){notify(error.message,true);} finally{setBusy(button,false);}
});
$("#media-input").addEventListener("change", async (event) => {
  const file=event.target.files[0]; if(!file)return;
  try { const uploaded=await state.repository.upload(file); if(state.uploadTarget) state.uploadTarget.value=uploaded.path; state.media=await state.repository.media(); renderAll(); notify("Obraz zapisany."); } catch(error){notify(error.message,true);} finally{state.uploadTarget=null;event.target.value="";}
});
document.addEventListener("click", async (event) => {
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="new-article")openArticle(); if(action==="add-news"){state.home.news.push({title:"",category:"",description:"",image:"",link:"/artykuly/"});renderRepeater("news",state.home.news);} if(action==="add-notice"){state.home.notices.push({title:"",category:"",date:"",description:"",contact:""});renderRepeater("notices",state.home.notices);} if(action==="upload-media")uploadImage(); if(action==="pick-article-image")uploadImage($("#article-form").image);
  if(action==="preview-article"){state.previewLanguage="pl";renderArticlePreview("pl");$("#preview-dialog").showModal();}
  if(action==="new-user"&&state.isAdmin)openUser();
  const editUser=event.target.closest("[data-edit-user]");if(editUser&&state.isAdmin)openUser(state.users.find(user=>user.id===editUser.dataset.editUser));
  if(action==="refresh-history"){try{state.history=await state.api.commits();renderHistory();notify("Historia została odświeżona.");}catch(error){notify(error.message,true);}}
  const remove=event.target.closest("[data-remove]"); if(remove&&await confirmAction('Usunąć element?','Element zniknie z formularza. Zmianę zapiszesz przyciskiem Zapisz.','Usuń')){const type=remove.dataset.remove;state.home[type].splice(Number(remove.closest("[data-index]").dataset.index),1);renderRepeater(type,state.home[type]);}
  const newsUpload=event.target.closest("[data-news-upload]"); if(newsUpload)uploadImage($(`#news-editor [data-index="${newsUpload.dataset.newsUpload}"] [data-field="image"]`));
  const edit=event.target.closest("[data-edit-article]"); if(edit)openArticle(state.articles.find((item)=>item.slug===edit.dataset.editArticle));
  const openAi=event.target.closest('[data-open-ai]'); if(openAi)document.dispatchEvent(new CustomEvent('cms:open-ai',{detail:openAi.dataset.openAi}));
  const removeArticle=event.target.closest("[data-delete-article]"); if(removeArticle&&await confirmAction('Trwale usunąć artykuł?','Artykuł zostanie usunięty z magazynu treści.','Usuń artykuł')){try{const article=state.articles.find((item)=>item.slug===removeArticle.dataset.deleteArticle);await state.repository.deleteArticle(article);state.articles=await state.repository.articles();renderAll();notify("Artykuł usunięty.");}catch(error){notify(error.message,true);}}
  const removeMedia=event.target.closest("[data-delete-media]"); if(removeMedia&&await confirmAction('Trwale usunąć obraz?','Obraz zostanie usunięty z biblioteki.','Usuń obraz')){try{const file=state.media.find((item)=>item.path===removeMedia.dataset.deleteMedia);await state.repository.deleteMedia(file);state.media=await state.repository.media();renderAll();notify("Obraz usunięty.");}catch(error){notify(error.message,true);}}
  const previewLanguage=event.target.closest("[data-preview-language]");if(previewLanguage)renderArticlePreview(previewLanguage.dataset.previewLanguage);
  if(event.target.closest("[data-close]"))event.target.closest("dialog").close();
});
$('#user-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; setBusy(button, true);
  const values = formData(event.target);
  try {
    await auth.saveUser({ ...values, active: values.active === 'true', id: state.editingUser?.id, version: state.editingUser?.version });
    event.target.reset(); $('#user-dialog').close(); state.users = await auth.users(); renderUsers(); notify('Konto zapisane.');
  } catch (error) { $('#user-error').textContent = error.message; } finally { setBusy(button, false); }
});
function setBusy(button,busy){if(!button)return;button.disabled=busy;if(busy){button.dataset.label=button.textContent;button.textContent="Zapisywanie…";}else if(button.dataset.label)button.textContent=button.dataset.label;}

initialize();
