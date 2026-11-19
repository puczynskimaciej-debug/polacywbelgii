const blocked = /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i;
const privateIp = /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fc[0-9a-f:]+$|fd[0-9a-f:]+$)/i;

export function safeResearchUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !blocked.test(url.hostname) && !privateIp.test(url.hostname) && !/^\d+(?:\.\d+){3}$/.test(url.hostname) && !url.hostname.includes(':');
  } catch { return false; }
}

export function searchTerms(prompt) {
  const words = String(prompt).replace(/https:\/\/\S+/g,' ').replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(word=>word.length>3).slice(0,7);
  return [...new Set([`Belgium ${words.join(' ')}`,`Belgique ${words.slice(0,4).join(' ')}`])];
}

export async function searchWikimedia(term,fetcher=fetch) {
  const query=async search=>{
    const url=new URL('https://en.wikipedia.org/w/api.php');
    url.search=new URLSearchParams({action:'query',list:'search',srsearch:search,srlimit:'6',format:'json'}).toString();
    const response=await fetcher(url.href,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':'PolacywBelgiiEditorial/1.0 (kontakt@polacywbelgii.eu)'}});
    if (!response.ok) throw new Error('source_search_unavailable');
    const data=await response.json();
    return (data.query?.search||[]).filter(row=>row.ns===0).map(row=>({url:`https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replaceAll(' ','_'))}`,title:row.title,domain:'en.wikipedia.org',kind:'encyclopedia'}));
  };
  let results=await query(term);
  if (!results.length) {
    const location=/brussels/i.test(term)?'Brussels':'Belgium';
    const topic=term.match(/transport|housing|rent|employment|jobs|wages|healthcare|school|education|immigration|culture|polish community/i)?.[0]||'life';
    results=await query(`${location} ${topic}`);
  }
  return results.slice(0,3);
}

export async function searchNews(prompt,{fetcher=fetch,terms=searchTerms(prompt)}={}) {
  const found=[];
  let successful=false;
  let rateLimited=false;
  for (const [index,term] of terms.slice(0,2).entries()) {
    if (index) await new Promise(resolve=>setTimeout(resolve,5500));
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.search = new URLSearchParams({query:term,mode:'ArtList',format:'json',maxrecords:'12',timespan:'3m',sort:'DateDesc'}).toString();
    for (let attempt=0;attempt<2;attempt++) {
      try {
        const response = await fetcher(url.href,{signal:AbortSignal.timeout(28000),headers:{Accept:'application/json'}});
        if (response.status===429) {rateLimited=true;break;}
        if (!response.ok || !String(response.headers.get('content-type')||'').includes('json')) break;
        const payload = await response.text();
        if (payload.length>500000) break;
        found.push(...(JSON.parse(payload).articles||[]));successful=true;break;
      } catch { /* The next query or retry may still work. */ }
    }
    if (rateLimited) break;
    if (found.length>=6) break;
  }
  if (!successful) throw new Error('source_search_unavailable');
  const unique = new Map();
  for (const item of found) {
    if (!safeResearchUrl(item.url) || !item.title || unique.has(item.url)) continue;
    unique.set(item.url,{url:item.url,title:String(item.title).slice(0,220),publishedAt:item.seendate||null,domain:new URL(item.url).hostname});
  }
  return [...unique.values()].slice(0,18);
}

export async function fetchResearchPage(url,fetcher=fetch) {
  if (!safeResearchUrl(url)) throw new Error('unsafe_source_url');
  if (new URL(url).hostname==='en.wikipedia.org') {
    const page=new URL(url).pathname.split('/wiki/')[1];
    if (!page) throw new Error('source_unavailable');
    const endpoint=new URL('https://en.wikipedia.org/w/api.php');
    endpoint.search=new URLSearchParams({action:'query',prop:'extracts',explaintext:'1',titles:decodeURIComponent(page).replaceAll('_',' '),format:'json'}).toString();
    const response=await fetcher(endpoint.href,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':'PolacywBelgiiEditorial/1.0 (kontakt@polacywbelgii.eu)'}});
    if (!response.ok) throw new Error('source_unavailable');
    const data=await response.json();
    const content=String(Object.values(data.query?.pages||{})[0]?.extract||'').replace(/\s+/g,' ').slice(0,14000);
    if (content.length<400) throw new Error('source_too_short');
    return {url,content,fetchedAt:new Date().toISOString(),kind:'encyclopedia'};
  }
  const response = await fetcher(url,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000),redirect:'manual'});
  if (!response.ok || !String(response.headers.get('content-type')||'').includes('text/html')) throw new Error('source_unavailable');
  const html = await response.text();
  if (html.length>350000) throw new Error('source_too_large');
  const main = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const content = main.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>String.fromCodePoint(code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code))).replace(/&nbsp;|&thinsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
  if (content.length<400) throw new Error('source_too_short');
  return {url,content:content.slice(0,14000),fetchedAt:new Date().toISOString(),kind:/reddit\.com$|wykop\.pl$|forum/i.test(new URL(url).hostname)?'discussion':'report'};
}
