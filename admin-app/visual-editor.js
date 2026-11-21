import { renderMarkdown } from './ui.js';

const form=document.querySelector('#article-form');
const editors=new Map();
const unsupported=value=>/```|^\s*\|.*\|\s*$|<\/?[a-z][^>]*>/im.test(value);

function inline(node){
  if(node.nodeType===Node.TEXT_NODE)return node.textContent.replace(/([\\*_[\]`])/g,'\\$1');
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const text=[...node.childNodes].map(inline).join('');
  const tag=node.tagName;
  if(tag==='STRONG'||tag==='B')return `**${text}**`;
  if(tag==='EM'||tag==='I')return `*${text}*`;
  if(tag==='CODE')return `\`${text}\``;
  if(tag==='A')return `[${text}](${node.getAttribute('href')||''})`;
  if(tag==='IMG')return `![${node.getAttribute('alt')||''}](${node.getAttribute('src')||''})`;
  if(tag==='BR')return '  \n';
  return text;
}
function blocks(root){
  if(!root.children.length||[...root.children].some(node=>!['P','DIV','H2','H3','UL','OL','BLOCKQUOTE'].includes(node.tagName)))return [...root.childNodes].map(inline).join('').trim();
  return [...root.children].map(node=>{
    const tag=node.tagName,text=[...node.childNodes].map(inline).join('').trim();
    if(tag==='H2'||tag==='H3')return `${tag==='H2'?'##':'###'} ${text}`;
    if(tag==='UL'||tag==='OL')return [...node.children].map((li,index)=>`${tag==='OL'?`${index+1}.`:'-'} ${[...li.childNodes].map(inline).join('').trim()}`).join('\n');
    if(tag==='BLOCKQUOTE')return text.split('\n').map(line=>`> ${line}`).join('\n');
    return text;
  }).filter(Boolean).join('\n\n').trim();
}

for(const textarea of form.querySelectorAll('textarea[name^="body"]')){
  if(textarea.name==='body_en')continue;
  const wrap=document.createElement('div');wrap.className='visual-editor';
  const toolbar=document.createElement('div');toolbar.className='visual-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Formatowanie treści');
  const actions=[['bold','B'],['italic','I'],['h2','H2'],['h3','H3'],['ul','Lista'],['ol','Numerowana'],['link','Link'],['quote','Cytat']];
  for(const [action,label] of actions){const button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.visualAction=action;button.textContent=label;toolbar.append(button);}
  const source=document.createElement('button');source.type='button';source.className='secondary';source.textContent='Kod Markdown';source.setAttribute('aria-pressed','false');toolbar.append(source);
  const rich=document.createElement('div');rich.className='visual-surface article-preview';rich.contentEditable='true';rich.setAttribute('role','textbox');rich.setAttribute('aria-multiline','true');rich.setAttribute('aria-label',`Treść artykułu ${textarea.name}`);
  const note=document.createElement('p');note.className='muted';note.textContent='Podgląd odpowiada formatowaniu na stronie. Kod Markdown pozostaje dostępny.';
  wrap.append(toolbar,rich,note);textarea.before(wrap);
  textarea.required=false;
  const sync=()=>{
    const legacy=unsupported(textarea.value);
    rich.innerHTML=renderMarkdown(textarea.value);
    rich.hidden=legacy;textarea.hidden=!legacy;source.setAttribute('aria-pressed',String(legacy));
    note.textContent=legacy?'Ten artykuł zawiera zaawansowany Markdown. Edytuj kod, aby zachować jego formatowanie.':'Podgląd odpowiada formatowaniu na stronie. Kod Markdown pozostaje dostępny.';
  };
  rich.addEventListener('input',()=>{textarea.value=blocks(rich);});
  textarea.addEventListener('input',()=>{if(!rich.hidden)rich.innerHTML=renderMarkdown(textarea.value);});
  toolbar.addEventListener('mousedown',event=>{if(event.target.closest('[data-visual-action]'))event.preventDefault();});
  toolbar.addEventListener('click',event=>{
    const action=event.target.closest('[data-visual-action]')?.dataset.visualAction;
    if(!action)return;
    if(action==='link'){
      if(rich.hidden){
        const start=textarea.selectionStart,end=textarea.selectionEnd,label=textarea.value.slice(start,end);
        const url=window.prompt('Adres HTTPS linku');
        if(!label||!url||!/^https:\/\/[^\s]+$/.test(url))return;
        textarea.setRangeText(`[${label}](${url})`,start,end,'select');
        textarea.dispatchEvent(new Event('input',{bubbles:true}));
        return;
      }
      const anchor=window.getSelection()?.anchorNode;
      const existing=(anchor?.nodeType===Node.ELEMENT_NODE?anchor:anchor?.parentElement)?.closest?.('a');
      const url=window.prompt('Adres HTTPS linku',existing?.getAttribute('href')||'');
      if(!url||!/^https:\/\/[^\s]+$/.test(url))return;
      if(existing&&rich.contains(existing))existing.setAttribute('href',url);
      else{rich.focus();document.execCommand('createLink',false,url);}
    }else {rich.focus();if(action==='h2'||action==='h3'||action==='quote')document.execCommand('formatBlock',false,action==='quote'?'blockquote':action);
    else document.execCommand(({bold:'bold',italic:'italic',ul:'insertUnorderedList',ol:'insertOrderedList'})[action]);
    }
    rich.dispatchEvent(new Event('input',{bubbles:true}));
  });
  source.addEventListener('click',()=>{const show=textarea.hidden;textarea.hidden=!show;rich.hidden=show;source.setAttribute('aria-pressed',String(show));if(!show)rich.innerHTML=renderMarkdown(textarea.value);});
  editors.set(textarea.name,sync);
}
document.addEventListener('cms:article-editor-open',()=>{for(const sync of editors.values())sync();});
