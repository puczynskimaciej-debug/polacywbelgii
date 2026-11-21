import { cmsConfig } from "./config.js";
import { CmsAuth } from "./modules/auth.js";
import { ContentApi } from "./modules/content-api.js";
import { ContentRepository } from "./modules/repository.js?v=20261121-article-tabs2";
import { cmsRequest } from './modules/client.js';
import { confirmAction, renderMarkdown } from './ui.js';

const state = { api: null, repository: null, user: null, isAdmin: false, home: null, homeSha: null, site: null, siteSha: null, articles: [], media: [], history: [], users: [], editingUser: null, editingAiId: null, uploadTarget: null, previewLanguage: "pl", language: "pl", homeAll: null, siteAll: null };
const auth = new CmsAuth();
const articleUi = {
  pl:{all:'Wszystkie',allStatuses:'Wszystkie statusy',editorial:'Redakcja',open:'Otwórz',edit:'Edytuj',remove:'Usuń',empty:'Brak artykułów pasujących do filtrów.',statuses:{draft:'Szkic',pending_review:'Do zatwierdzenia',changes_requested:'Wymaga poprawek',approved:'Zaakceptowany',scheduled:'Zaplanowany',published:'Opublikowany',rejected:'Odrzucony',archived:'Wycofany'}},
  en:{all:'All',allStatuses:'All statuses',editorial:'Editorial',open:'Open',edit:'Edit',remove:'Delete',empty:'No articles match these filters.',statuses:{draft:'Draft',pending_review:'Awaiting approval',changes_requested:'Changes requested',approved:'Approved',scheduled:'Scheduled',published:'Published',rejected:'Rejected',archived:'Withdrawn'}},
  nl:{all:'Alle',allStatuses:'Alle statussen',editorial:'Redactie',open:'Openen',edit:'Bewerken',remove:'Verwijderen',empty:'Geen artikelen voor deze filters.',statuses:{draft:'Concept',pending_review:'Ter goedkeuring',changes_requested:'Wijzigingen gevraagd',approved:'Goedgekeurd',scheduled:'Gepland',published:'Gepubliceerd',rejected:'Afgewezen',archived:'Ingetrokken'}},
  fr:{all:'Tous',allStatuses:'Tous les statuts',editorial:'Rédaction',open:'Ouvrir',edit:'Modifier',remove:'Supprimer',empty:'Aucun article pour ces filtres.',statuses:{draft:'Brouillon',pending_review:'À valider',changes_requested:'Modifications demandées',approved:'Approuvé',scheduled:'Planifié',published:'Publié',rejected:'Rejeté',archived:'Retiré'}}
};
let aiSnapshot = null;
let articleTab = sessionStorage.getItem('cms_article_tab') === 'working' ? 'working' : 'published';
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
    try { await loadContent(); $('#content-unavailable').hidden = true; $('.dashboard-stats article:first-child small').textContent='artykuły portalu'; } catch (error) { showContentUnavailable(error); }
    if (state.isAdmin) document.dispatchEvent(new Event('cms:load-ai'));
    document.dispatchEvent(new Event('cms:load-summary'));
  } catch (error) {
    showAuth(error.code === 'unauthorized' ? '' : error.message);
  }
}

async function loadContent() {
  const [home, site, articles, media, history] = await Promise.allSettled([state.repository.home(), state.repository.site(), state.repository.articles(), state.repository.media(), state.isAdmin ? state.api.commits() : Promise.resolve([])]);
  if (articles.status === 'rejected') throw articles.reason;
  state.articles = articles.value;
  state.media = media.status === 'fulfilled' ? media.value : [];
  state.history = history.status === 'fulfilled' ? history.value : [];
  if (home.status === 'fulfilled') [state.home, state.homeSha] = [home.value.data, home.value.sha];
  if (site.status === 'fulfilled') [state.site, state.siteSha] = [site.value.data, site.value.sha];
  if (!state.home || !state.site) {
    const unavailable = [home,site].filter(result => result.status === 'rejected').map(result => result.reason?.message || 'Brak konfiguracji');
    $('#content-status').textContent = `Artykuły są dostępne. Ustawienia strony wymagają naprawy: ${unavailable.join('; ')}`;
    $('#content-status').hidden = false;
  } else $('#content-status').hidden = true;
  state.homeAll=state.home; state.siteAll=state.site; selectContentLanguage();
  renderAll();
}
function showContentUnavailable(error) {
  $('#content-unavailable').hidden=false;
  $('#content-status').hidden=false;
  $('#content-status').textContent=error?.message || 'Nie udało się wczytać artykułów.';
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
  if (state.home) renderHome();
  renderArticles();
  if (state.site) renderSite();
  renderMedia(); renderHistory(); renderUsers();
  renderDashboard();
  document.dispatchEvent(new CustomEvent('cms:manual-articles',{detail:state.articles}));
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
$('#dashboard-refresh').addEventListener('click',async() => { try{await loadContent();$('#content-unavailable').hidden=true;$('.dashboard-stats article:first-child small').textContent='artykuły portalu';}catch(error){showContentUnavailable(error);} document.dispatchEvent(new Event('cms:load-ai')); document.dispatchEvent(new Event('cms:load-summary')); switchView('dashboard'); });
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
function publicationButtons(article,kind) {
  const id=escapeHtml(kind==='ai'?article.id:article.slug);
  const button=(action,label)=>`<button class="secondary" type="button" data-publication-action="${action}" data-publication-kind="${kind}" data-publication-id="${id}">${label}</button>`;
  if (!state.isAdmin) return '';
  if (article.status==='draft') return kind==='manual' ? button('publish-now','Opublikuj teraz')+button('schedule','Zaplanuj') : '';
  if (article.status==='approved') return button('publish-now','Opublikuj teraz')+button('schedule','Zaplanuj');
  if (article.status==='scheduled') return button('publish-now','Opublikuj teraz')+button('schedule','Zmień termin')+button('unschedule','Anuluj planowanie');
  if (article.status==='published') return (article.draft || article.editorial_draft ? button('publish-draft','Opublikuj zmiany') : '')+button('withdraw','Wycofaj');
  return '';
}
function renderArticles() {
  const ui=articleUi[state.language] || articleUi.pl;
  $$('[data-articles-tab]').forEach(button=>{ const selected=button.dataset.articlesTab===articleTab; button.classList.toggle('is-active',selected); button.setAttribute('aria-selected',String(selected)); button.textContent=button.dataset.articlesTab==='published' ? ({pl:'Opublikowane',nl:'Gepubliceerd',fr:'Publiés',en:'Published'}[state.language] || 'Opublikowane') : ({pl:'Robocze / oczekujące',nl:'Concepten / in afwachting',fr:'Brouillons / en attente',en:'Drafts / pending'}[state.language] || 'Robocze / oczekujące'); });
  const category=$('#articles-category'), previous=category.value;
  const ai=(aiSnapshot?.candidates||[]).filter(item=>item.kind==='article');
  const manual=storedArticles();
  const categories=[...new Set([...manual,...ai].map(article=>article.category).filter(Boolean))].sort();
  category.replaceChildren(new Option(ui.all,'')); categories.forEach(value=>category.add(new Option(value,value))); category.value=categories.includes(previous)?previous:'';
  for(const option of $('#articles-status').options) option.textContent=option.value ? ui.statuses[option.value] : ui.allStatuses;
  const query=$('#articles-search').value.trim().toLocaleLowerCase('pl'), status=$('#articles-status').value;
  const matches=article=>(!query||`${article.title} ${article.category}`.toLocaleLowerCase('pl').includes(query))&&(!category.value||article.category===category.value)&&(!status||article.status===status);
  const articles=manual.filter(article=>matches(article) && (article.status==='published') === (articleTab==='published'));
  const aiArticles=ai.filter(article=>matches(article) && Boolean(article.status==='published' && article.public_state==='visible' && article.approved_by && article.approved_at) === (articleTab==='published'));
  const manualRows=articles.map(article=>`<div class="table-row"><div><h3>${escapeHtml((state.language==='pl'?article.title:article[`title_${state.language}`])||'Brak wersji w tym języku: '+article.title)}</h3><p>${escapeHtml(article.category||'Bez kategorii')} · ${formatDate(article.published_at||article.scheduled_at||article.date)} · ${escapeHtml(ui.statuses[article.status] || article.status)} · ${ui.editorial}</p></div><div class="row-actions"><button class="secondary" data-edit-article="${escapeHtml(article.slug)}">${ui.edit}</button>${publicationButtons(article,'manual')}<button class="ghost danger" data-delete-article="${escapeHtml(article.slug)}">${ui.remove}</button></div></div>`);
  const aiRows=aiArticles.map(article=>`<div class="table-row"><div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.category||'Bez kategorii')} · ${escapeHtml(ui.statuses[article.status]||article.status)} · AI Redaktor</p></div><div class="row-actions"><button class="secondary" data-edit-ai="${article.id}">${ui.edit}</button>${publicationButtons(article,'ai')}<button class="secondary" data-open-ai="${article.id}">${ui.open}</button></div></div>`);
  const dateValue=value=>value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.NEGATIVE_INFINITY;
  const rows=[...articles.map((article,index)=>({html:manualRows[index],date:dateValue(articleTab==='published'?article.published_at:article.updated_at)})),...aiArticles.map((article,index)=>({html:aiRows[index],date:articleTab==='published'?dateValue(article.published_at):Math.max(dateValue(article.updated_at),dateValue(article.editorial_updated_at))}))];
  rows.sort((first,second)=>first.date===second.date?0:first.date>second.date?-1:1);
  $("#articles-list").innerHTML = rows.map(row=>row.html).join('')||`<p class="empty-state">${ui.empty}</p>`;
}
$$('[data-articles-tab]').forEach(button=>button.addEventListener('click',()=>{ articleTab=button.dataset.articlesTab; sessionStorage.setItem('cms_article_tab',articleTab); $('#articles-status').value=''; renderArticles(); }));
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
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? String(value || "") : new Intl.DateTimeFormat('pl-PL',{dateStyle:'medium',timeZone:'Europe/Brussels'}).format(date); }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? String(value || "") : new Intl.DateTimeFormat('pl-PL',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Brussels'}).format(date); }
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

function openArticle(article = null) {
  const form = $("#article-form"); form.reset(); state.editingAiId = article?.aiId || null; $("#article-dialog-title").textContent = article ? "Edytuj artykuł" : "Nowy artykuł";
  const values = article ? { ...article,...(article.draft || {}) } : { date: new Date().toISOString() }; Object.entries(values).forEach(([key,value]) => { if (form.elements[key]) form.elements[key].value = key === "date" ? brusselsDateTime(value) : value || ""; });
  populateArticleMedia();
  ['pl','nl','fr'].forEach(refreshArticleLanguageMedia);
  form.elements.status.value = ['draft','scheduled','published'].includes(article?.status) ? article.status : 'draft';
  form.elements.status.disabled = Boolean(state.editingAiId);
  form.elements.status.querySelector('[value="published"]').disabled = !state.isAdmin;
  $('#article-ai-note').hidden = !state.editingAiId;
  $('#article-editor-publication').innerHTML=article ? publicationButtons(article,article.aiId?'ai':'manual') : '';
  $('#article-publish-draft').hidden = !article || article.status !== 'published' || !state.isAdmin;
  form.slug.value = article?.slug || ""; document.dispatchEvent(new Event('cms:article-editor-open')); $("#article-dialog").showModal(); document.querySelector(`[data-language-tab="${state.language}"]`).click();
}
function brusselsDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return '';
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');
}
function brusselsLocalToUtc(value,fold='earlier') {
  const base=Date.parse(`${value}:00Z`);
  if (!Number.isFinite(base)) throw new Error('Podaj poprawną datę publikacji.');
  const matches=[1,2].map(hours=>new Date(base-hours*3600000)).filter(date=>brusselsDateTime(date)===value);
  if (!matches.length) throw new Error('Ta godzina nie istnieje w Polsce i Belgii z powodu zmiany czasu.');
  return (matches.length===2 && fold==='earlier' ? matches[1] : matches[0]).toISOString();
}
function aiArticle(row) {
  let fields={},sources=[];
  try { fields=JSON.parse(row.article_fields_json || '{}'); } catch { /* Legacy candidate */ }
  try { sources=JSON.parse(row.sources_json || '[]'); } catch { /* Legacy candidate */ }
  let draft=null;
  try { const value=JSON.parse(row.editorial_draft?.content || 'null'); if(value) draft={...value,...value.articleFields,sources:value.sources.map(source=>source.url).join('\n')}; } catch { /* Invalid draft remains unavailable for editing. */ }
  return { aiId:row.id, title:row.title, description:row.description, body:row.body, date:row.published_at || row.scheduled_at || row.proposed_publish_at || row.created_at, category:row.category || 'Życie w Belgii', region:row.region || 'all', sources:sources.map(source=>source.url).filter(Boolean).join('\n'), ...fields, status:row.status, editorial_draft:row.editorial_draft, draft };
}
async function uploadImage(target = null) { state.uploadTarget = target; $("#media-input").click(); }
function articleImage(form, language) { return form.elements[`image_${language}`]?.value.trim() || form.elements.image.value.trim(); }
function articleTags(form, language) { return form.elements[`tags_${language}`]?.value.trim() || form.elements.tags.value.trim(); }
function articleMediaPath(file) { return `/${file.path.replace(/^\//, '').replace(/^src\//, '').replace(/^Images\//, 'images/')}`; }
function populateArticleMedia() {
  ['pl','nl','fr'].forEach(language => {
    const select = document.querySelector(`[data-article-media-select="${language}"]`);
    select.replaceChildren(new Option('Wybierz z biblioteki mediów', ''));
    state.media.forEach(file => select.add(new Option(file.name, articleMediaPath(file))));
  });
}
function refreshArticleLanguageMedia(language) {
  const form = $('#article-form');
  const custom = form.elements[`image_${language}`].value.trim();
  const image = articleImage(form, language);
  const preview = document.querySelector(`[data-article-image-preview="${language}"]`);
  preview.hidden = !image;
  if (image) preview.src = image; else preview.removeAttribute('src');
  document.querySelector(`[data-article-image-note="${language}"]`).textContent = custom ? 'Zdjęcie tej wersji językowej' : image ? 'Zdjęcie wspólne (starszy artykuł)' : 'Brak zdjęcia';
  document.querySelector(`[data-article-media-select="${language}"]`).value = state.media.some(file => articleMediaPath(file) === custom) ? custom : '';
}
document.addEventListener('cms:upload-event-image', event => uploadImage(event.detail));
document.addEventListener('cms:edit-ai-article',event => { const row=(aiSnapshot?.candidates||[]).find(item=>item.id===event.detail); if(row)openArticle(aiArticle(row)); });
document.addEventListener('cms:edit-manual-article',event => { const row=state.articles.find(item=>item.slug===event.detail); if(row)openArticle(row); });
document.addEventListener('cms:manual-articles-request',()=>document.dispatchEvent(new CustomEvent('cms:manual-articles',{detail:state.articles})));
function renderArticlePreview(language = state.previewLanguage) {
  state.previewLanguage = language;
  const form = $("#article-form");
  const suffix = language === "pl" ? "" : `_${language}`;
  const title = form.elements[`title${suffix}`]?.value.trim() || form.title.value.trim() || "Bez tytułu";
  const description = form.elements[`description${suffix}`]?.value.trim() || form.description.value.trim();
  const body = form.elements[`body${suffix}`]?.value.trim() || form.body.value.trim();
  const image = articleImage(form, language);
  const tags = articleTags(form, language).split(',').map(tag => tag.trim()).filter(Boolean);
  $("#preview-title").textContent = title;
  $("#article-preview").innerHTML = `${image ? `<img src="${escapeHtml(image)}" alt="">` : ""}<h1>${escapeHtml(title)}</h1><p class="preview-description">${escapeHtml(description)}</p>${tags.length ? `<div class="article-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}${renderMarkdown(body)}`;
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
$$("[data-language-tab]").forEach((button) => button.addEventListener("click", () => { $$("[data-language-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button)); $$("[data-language-pane]").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.languagePane === button.dataset.languageTab)); if (['pl','nl','fr'].includes(button.dataset.languageTab)) refreshArticleLanguageMedia(button.dataset.languageTab); }));
$$("[data-article-media-select]").forEach(select => select.addEventListener('change', () => { $('#article-form').elements[`image_${select.dataset.articleMediaSelect}`].value = select.value; refreshArticleLanguageMedia(select.dataset.articleMediaSelect); }));
$$("[data-article-image-clear]").forEach(button => button.addEventListener('click', () => { $('#article-form').elements[`image_${button.dataset.articleImageClear}`].value = ''; refreshArticleLanguageMedia(button.dataset.articleImageClear); }));
$('#article-form').addEventListener('input', event => { const language = event.target.name?.match(/^image_(pl|nl|fr)$/)?.[1]; if (language) refreshArticleLanguageMedia(language); });

$("#home-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; setBusy(button, true);
  try { Object.assign(state.home, { hero: { eyebrow: event.target.eyebrow.value.trim(), title: event.target.title.value.trim(), description: event.target.description.value.trim() }, news: readRepeater("news"), notices: readRepeater("notices") }); state.home.news.forEach((item, index) => { if (state.homeAll.news[index]) state.homeAll.news[index].region = item.region; }); const result = await state.repository.saveHome(state.homeAll, state.homeSha); state.homeSha = result.content.sha; notify("Zapisano w magazynie D1."); renderAll(); } catch(error) { notify(error.message,true); } finally { setBusy(button,false); }
});
$("#site-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; setBusy(button,true);
  try { state.site.contact = { email:event.target.elements["contact.email"].value.trim(), area:event.target.elements["contact.area"].value.trim(), heading:event.target.elements["contact.heading"].value.trim(), description:event.target.elements["contact.description"].value.trim() }; $$("[data-seo]").forEach((field) => { const [page,key]=field.dataset.seo.split("."); state.site.seo[page][key]=field.value.trim(); }); const result=await state.repository.saveSite(state.siteAll,state.siteSha); state.siteSha=result.content.sha; notify("Ustawienia kontaktu i SEO zapisane."); } catch(error){notify(error.message,true);} finally{setBusy(button,false);}
});
$("#article-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button=event.submitter; setBusy(button,true); const values=formData(event.target); values.contentType='article'; const original=state.articles.find((article)=>article.slug===values.slug); values.status=original?.status || 'draft';
  try {
    const publishChanges=button.id==='article-publish-draft';
    if (publishChanges && !await confirmAction('Opublikować zmiany?','Nowa wersja zastąpi aktualnie widoczną treść artykułu.')) return;
    if (!values.body?.trim()) throw new Error('Treść artykułu nie może być pusta.');
    if (state.editingAiId) {
      const row=(aiSnapshot?.candidates||[]).find(item=>item.id===state.editingAiId);
      if (!row) throw new Error('Nie znaleziono artykułu AI. Odśwież kolejkę.');
      await cmsRequest('ai-editor',{},'POST',{action:'edit',id:row.id,title:values.title.trim(),description:values.description.trim(),body:values.body.trim(),category:values.category,region:values.region,sources:values.sources.split(/\r?\n/).map(url=>url.trim()).filter(Boolean).map(url=>({url})),articleFields:Object.fromEntries(['title_nl','description_nl','body_nl','title_fr','description_fr','body_fr','image','tags','image_pl','image_nl','image_fr','tags_pl','tags_nl','tags_fr'].map(key=>[key,values[key] || '']))});
      if (publishChanges) await cmsRequest('ai-editor',{},'POST',{action:'publish-draft',id:row.id});
      document.dispatchEvent(new Event('cms:load-ai'));
      notify(publishChanges ? 'Zmiany artykułu opublikowane.' : row.status==='published' ? 'Wersja robocza zmian zapisana. Opublikowany artykuł pozostaje widoczny.' : 'Poprawki AI zapisane. Przed publikacją ponownie zweryfikuj treść i źródła.');
    } else {
      values.date = brusselsLocalToUtc(values.date);
      await state.repository.saveArticle(values,original);
      if (publishChanges) await state.repository.publishDraft(original);
      state.articles=await state.repository.articles(); renderAll(); notify(publishChanges ? 'Zmiany artykułu opublikowane.' : original?.status==='published' ? 'Wersja robocza zmian zapisana. Opublikowany artykuł pozostaje widoczny.' : 'Szkic zapisany w D1.');
    }
    $("#article-dialog").close();
  } catch(error){notify(error.message,true);} finally{setBusy(button,false);}
});
$("#media-input").addEventListener("change", async (event) => {
  const file=event.target.files[0]; if(!file)return;
  try { const uploaded=await state.repository.upload(file); if(state.uploadTarget) { state.uploadTarget.value=uploaded.path; state.uploadTarget.dispatchEvent(new Event('input',{bubbles:true})); } state.media=await state.repository.media(); populateArticleMedia(); renderAll(); notify("Obraz zapisany."); } catch(error){notify(error.message,true);} finally{state.uploadTarget=null;event.target.value="";}
});
let scheduleTarget=null;
async function publicationAction(kind,id,action,scheduledAt=null,fold='earlier') {
  if (!state.isAdmin) throw new Error('Tylko administrator może zmienić publikację.');
  if (kind==='manual') {
    const article=state.articles.find(item=>item.slug===id);
    if (!article) throw new Error('Artykuł nie istnieje. Odśwież listę.');
    if (action==='publish-draft') await state.repository.publishDraft(article);
    else await state.repository.publication(article,action,scheduledAt);
    state.articles=await state.repository.articles();
    renderAll();
  } else {
    const row=(aiSnapshot?.candidates||[]).find(item=>item.id===id);
    if (!row) throw new Error('Materiał AI nie istnieje. Odśwież kolejkę.');
    if (action==='publish-draft') await cmsRequest('ai-editor',{},'POST',{action:'publish-draft',id});
    else if (action==='publish-now') await cmsRequest('ai-editor',{},'POST',{action:'publish-now',id});
    else if (action==='schedule') await cmsRequest('ai-editor',{},'POST',{action:'status',id,status:'scheduled',localTime:brusselsDateTime(scheduledAt),fold});
    else await cmsRequest('ai-editor',{},'POST',{action:'status',id,status:action==='withdraw'?'archived':'draft'});
    document.dispatchEvent(new Event('cms:load-ai'));
  }
  if ($('#article-dialog').open) $('#article-dialog').close();
}
document.addEventListener('cms:article-publication',event=>{
  const {kind,id,action}=event.detail || {};
  document.dispatchEvent(new CustomEvent('cms:publication-request',{detail:{kind,id,action}}));
});
document.addEventListener('cms:publication-request',async event=>{
  const {kind,id,action}=event.detail || {};
  if (!['manual','ai'].includes(kind) || !['publish-now','schedule','unschedule','withdraw','publish-draft'].includes(action)) return;
  if (action==='schedule') {
    scheduleTarget={kind,id};
    const article=kind==='manual'?state.articles.find(item=>item.slug===id):(aiSnapshot?.candidates||[]).find(item=>item.id===id);
    if (!article) { notify('Nie znaleziono artykułu. Odśwież listę.',true); return; }
    $('#article-schedule-title').textContent=article.status==='scheduled'?'Zmień termin publikacji':'Zaplanuj publikację';
    $('#article-schedule-form').elements.localTime.value=brusselsDateTime(article.scheduled_at || new Date(Date.now()+3600000).toISOString());
    $('#article-schedule-error').textContent='';
    $('#article-schedule-dialog').showModal();
    return;
  }
  const labels={'publish-now':['Opublikować teraz?','Artykuł będzie od razu widoczny publicznie.'],'publish-draft':['Opublikować zmiany?','Nowa wersja zastąpi aktualnie widoczną treść artykułu.'],'unschedule':['Anulować planowanie?','Artykuł wróci do szkiców.'],'withdraw':['Wycofać publikację?','Artykuł zniknie z publicznych list.']};
  if (!await confirmAction(...labels[action])) return;
  try { await publicationAction(kind,id,action); notify(action==='publish-now'?'Artykuł opublikowany.':action==='publish-draft'?'Zmiany artykułu opublikowane.':action==='withdraw'?'Artykuł wycofany.':'Planowanie anulowane.'); }
  catch(error){notify(`Nie udało się zmienić publikacji: ${error.message}`,true);}
});
$('#article-schedule-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,local=form.elements.localTime.value,error=$('#article-schedule-error');
  let utc; try { utc=brusselsLocalToUtc(local,form.elements.fold.value); if(Date.parse(utc)<=Date.now()) throw new Error('Wybierz przyszły termin.'); }
  catch(e){error.textContent=e.message;return;}
  if(!await confirmAction('Zapisać termin publikacji?',`Publikacja: ${formatDateTime(utc)}.`))return;
  try { await publicationAction(scheduleTarget.kind,scheduleTarget.id,'schedule',utc,form.elements.fold.value); $('#article-schedule-dialog').close(); notify('Termin publikacji zapisany.'); }
  catch(e){error.textContent=`Nie zapisano terminu: ${e.message}`;}
});
$('#article-schedule-form').elements.localTime.addEventListener('input',event=>{
  const value=event.target.value;
  const base=Date.parse(`${value}:00Z`);
  const matches=[1,2].map(hours=>new Date(base-hours*3600000)).filter(date=>brusselsDateTime(date)===value);
  $('#article-schedule-fold').hidden=matches.length!==2;
});
document.addEventListener("click", async (event) => {
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="new-article")openArticle(); if(action==="add-news"){state.home.news.push({title:"",category:"",description:"",image:"",link:"/artykuly/"});renderRepeater("news",state.home.news);} if(action==="add-notice"){state.home.notices.push({title:"",category:"",date:"",description:"",contact:""});renderRepeater("notices",state.home.notices);} if(action==="upload-media")uploadImage(); if(action==="pick-article-image")uploadImage($("#article-form").elements[`image_${event.target.closest('[data-image-language]').dataset.imageLanguage}`]);
  if(action==="preview-article"){state.previewLanguage="pl";renderArticlePreview("pl");$("#preview-dialog").showModal();}
  if(action==="new-user"&&state.isAdmin)openUser();
  const editUser=event.target.closest("[data-edit-user]");if(editUser&&state.isAdmin)openUser(state.users.find(user=>user.id===editUser.dataset.editUser));
  if(action==="refresh-history"){try{state.history=await state.api.commits();renderHistory();notify("Historia została odświeżona.");}catch(error){notify(error.message,true);}}
  const remove=event.target.closest("[data-remove]"); if(remove&&await confirmAction('Usunąć element?','Element zniknie z formularza. Zmianę zapiszesz przyciskiem Zapisz.','Usuń')){const type=remove.dataset.remove;state.home[type].splice(Number(remove.closest("[data-index]").dataset.index),1);renderRepeater(type,state.home[type]);}
  const newsUpload=event.target.closest("[data-news-upload]"); if(newsUpload)uploadImage($(`#news-editor [data-index="${newsUpload.dataset.newsUpload}"] [data-field="image"]`));
  const edit=event.target.closest("[data-edit-article]"); if(edit)openArticle(state.articles.find((item)=>item.slug===edit.dataset.editArticle));
  const publication=event.target.closest('[data-publication-action]'); if(publication)document.dispatchEvent(new CustomEvent('cms:publication-request',{detail:{kind:publication.dataset.publicationKind,id:publication.dataset.publicationId,action:publication.dataset.publicationAction}}));
  const unpublish=event.target.closest('[data-unpublish-article]');if(unpublish && await confirmAction('Wycofać artykuł?', 'Artykuł zniknie ze strony, ale pozostanie w CMS jako szkic.')){try{const article=state.articles.find(item=>item.slug===unpublish.dataset.unpublishArticle);await state.repository.saveArticle({...article,status:'draft'},article);state.articles=await state.repository.articles();renderAll();notify('Artykuł wycofano. Pozostał w CMS jako szkic.');}catch(error){notify(error.message,true);}}
  const editAi=event.target.closest('[data-edit-ai]');if(editAi){const row=(aiSnapshot?.candidates||[]).find(item=>item.id===editAi.dataset.editAi);if(row)openArticle(aiArticle(row));}
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
