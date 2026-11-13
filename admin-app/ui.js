const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
export { escapeHtml };

export function formatDate(value, withTime = false) {
  if (!value) return 'Brak terminu';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Brak terminu';
  return new Intl.DateTimeFormat('pl-PL',{ dateStyle:'medium',...(withTime ? { timeStyle:'short' } : {}),timeZone:'Europe/Brussels' }).format(date);
}

export function renderMarkdown(value) {
  const inline = text => escapeHtml(text)
    .replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g,(_match,label,url) => `<img src="${url}" alt="${label}">`)
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,(_match,label,url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
  return String(value || '').trim().split(/\n\s*\n/).filter(Boolean).map(block => {
    const lines = block.split('\n');
    if (/^#{1,3} /.test(block)) { const level = /^#+/.exec(block)[0].length; return `<h${level}>${inline(block.slice(level+1))}</h${level}>`; }
    if (lines.every(line => /^[-*] /.test(line))) return `<ul>${lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
    if (lines.every(line => /^\d+\. /.test(line))) return `<ol>${lines.map(line => `<li>${inline(line.replace(/^\d+\. /,''))}</li>`).join('')}</ol>`;
    if (lines.every(line => /^> ?/.test(line))) return `<blockquote>${lines.map(line => inline(line.replace(/^> ?/,''))).join('<br>')}</blockquote>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}

export function confirmAction(title, message, acceptLabel = 'Potwierdź') {
  const dialog = document.querySelector('#cms-confirm-dialog');
  document.querySelector('#cms-confirm-title').textContent = title;
  document.querySelector('#cms-confirm-message').textContent = message;
  const accept = document.querySelector('#cms-confirm-accept');
  accept.textContent = acceptLabel;
  dialog.showModal();
  return new Promise(resolve => {
    const finish = answer => { dialog.close(); cleanup(); resolve(answer); };
    const yes = () => finish(true);
    const no = () => finish(false);
    const cancel = event => { event.preventDefault(); finish(false); };
    const cleanup = () => { accept.removeEventListener('click',yes); dialog.querySelectorAll('[data-confirm-cancel]').forEach(node => node.removeEventListener('click',no)); dialog.removeEventListener('cancel',cancel); };
    accept.addEventListener('click',yes);
    dialog.querySelectorAll('[data-confirm-cancel]').forEach(node => node.addEventListener('click',no));
    dialog.addEventListener('cancel',cancel);
    accept.focus();
  });
}

export function enableTabKeyboard(container) {
  container.addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs=[...container.querySelectorAll('[role=tab]')];
    const current=tabs.indexOf(document.activeElement);
    if(current<0)return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].focus();tabs[next].click();
  });
}
