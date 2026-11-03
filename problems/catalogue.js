import {normalize, selectProblems, validTagIds} from './catalogue-core.mjs';

const $ = id => document.getElementById(id);
const PAGE_SIZE = 20;
let data, tags, filters, page = 1;
const node = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
};
function sourceLink(label, url, className='source-link') {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const a = node('a', className, label);
  a.href=parsed.href; a.target='_blank'; a.rel='noopener noreferrer';
  return a;
}
function shorten(label) { return label.replace(/^[ACN]: /, ''); }
function readFilters() {
  const q = new URLSearchParams(location.search);
  return {query:q.get('q')||'', contest:['isl','rmm'].includes(q.get('contest'))?q.get('contest'):'',
    subject:['A','C','N'].includes(q.get('subject'))?q.get('subject'):'',
    evidence:['live','archive','pending'].includes(q.get('evidence'))?q.get('evidence'):'',
    from:q.get('from')||'', to:q.get('to')||'', mode:q.get('mode')==='OR'?'OR':'AND',
    tags:validTagIds((q.get('tags')||'').split(','),data.taxonomy),
    problem:data.problems.some(p=>p.key===q.get('problem'))?q.get('problem'):''};
}
function searchUrl(override={}) {
  const f={...filters,...override}, q=new URLSearchParams();
  for(const [key,val] of Object.entries({q:f.query,contest:f.contest,subject:f.subject,evidence:f.evidence,from:f.from,to:f.to,problem:f.problem})) if(val)q.set(key,val);
  if(f.tags.length)q.set('tags',f.tags.join(','));
  if(f.mode==='OR')q.set('mode','OR');
  return location.pathname+(q.size?'?'+q:'');
}
function syncControls() {
  for(const [id,key] of [['search','query'],['contest','contest'],['subject','subject'],['evidence','evidence'],['from-year','from'],['to-year','to']]) $(id).value=filters[key];
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===filters.mode)));
}
function toggleTag(id) {
  filters.tags=filters.tags.includes(id)?filters.tags.filter(t=>t!==id):[...filters.tags,id];
  filters.problem=''; page=1; render();
}
function renderTags() {
  $('selection-count').textContent=`${filters.tags.length} selected`;
  $('selected-tags').replaceChildren(...filters.tags.map(id=>{
    const b=node('button', 'selected-chip',`${id} · ${shorten(tags.get(id).label)} ×`);
    b.type='button';b.title=`Remove ${tags.get(id).label}`;b.addEventListener('click',()=>toggleTag(id));return b;
  }));
  const query=normalize($('tag-search').value).trim();
  const options=[];
  for(const [subject,title] of [['A','Algebra'],['C','Combinatorics'],['N','Number theory']]) {
    const found=data.taxonomy.filter(t=>t.subject===subject && (!query || normalize(`${t.id} ${t.label} ${t.definition}`).includes(query)));
    if(!found.length)continue;
    options.push(node('h4','tag-group-title',title));
    for(const t of found){
      const b=node('button','tag-option');b.type='button';b.setAttribute('aria-pressed',String(filters.tags.includes(t.id)));b.title=t.definition;
      b.append(node('span','tag-number',t.id),node('span','tag-name',shorten(t.label)),node('span','tag-check',filters.tags.includes(t.id)?'✓':'+'));
      b.addEventListener('click',()=>toggleTag(t.id));options.push(b);
    }
  }
  if(!options.length)options.push(node('p','tag-empty','No matching tags. Try a method name or an ID from 1 to 60.'));
  $('tag-options').replaceChildren(...options);
}
function problemCard(result) {
  const p=result.problem, card=node('article',`problem-card subject-${p.subject.toLowerCase()}`);
  const top=node('div','card-top'), titlebox=node('div'), meta=node('p','problem-meta',`${p.contestName}  /  ${p.section}  /  ${p.year}`);
  const title=node('h3',null,`${p.year} ${p.id}`); titlebox.append(meta,title);
  const label={A:'Algebra',C:'Combinatorics',N:'Number theory'}[p.subject]||p.subject;
  top.append(titlebox,node('span','subject-label',label));card.append(top);
  const pills=node('div','problem-tags');
  for(const id of p.tags){
    const b=node('button',`method-pill${id===p.primaryTag?' primary':''}${filters.tags.includes(id)?' matched':''}`,`${id===p.primaryTag?'◈ ':''}${shorten(tags.get(id).label)}`);
    b.type='button';b.title=`${id===p.primaryTag?'Primary':'Additional'} method · tag ${id}. Click to filter.`;
    b.setAttribute('aria-pressed',String(filters.tags.includes(id)));b.addEventListener('click',()=>toggleTag(id));pills.append(b);
  }
  card.append(pills,node('p','classification',p.explanation));
  const row=node('div','card-bottom'), links=node('div','source-links');
  if(p.aopsUrl) links.append(sourceLink('AoPS statement & discussion ↗',p.aopsUrl));
  if(p.officialUrl) links.append(sourceLink('Official / source document ↗',p.officialUrl));
  const badge=node('span',`evidence-badge ${p.forumStatus}`,{live:'Live forum checked',archive:'Archived forum checked',pending:'Forum check pending'}[p.forumStatus]);
  row.append(links,badge);card.append(row);
  if(filters.tags.length)card.append(node('p','match-note',`${result.primary?'Primary method match':'Additional method match'} · ${result.hits} selected ${result.hits===1?'tag':'tags'}`));
  const detail=node('details','research-notes');detail.append(node('summary',null,'Research notes & source caveats'));
  const content=node('div','research-content');content.append(node('p','source-type',p.evidence),node('p','source-note',p.notes));
  const refs=node('ul','reference-list');
  for(const url of [...new Set(p.sourceUrls)]){ const a=sourceLink(url,url);if(a){const li=node('li');li.append(a);refs.append(li);} }
  content.append(refs);detail.append(content);card.append(detail);
  const permalink=node('button','text-button permalink','Copy entry link');permalink.type='button';
  permalink.addEventListener('click',()=>copyUrl(new URL(searchUrl({query:'',contest:'',subject:'',evidence:'',from:'',to:'',tags:[],problem:p.key}),location.origin).href,permalink));card.append(permalink);
  return card;
}
function render() {
  history.replaceState(null,'',searchUrl());renderTags();
  const warning=filters.from&&filters.to&&Number(filters.from)>Number(filters.to);
  $('filter-warning').hidden=!warning;
  $('filter-warning').textContent=warning?'Choose a starting year no later than the ending year.':'';
  const results=selectProblems(data.problems,data.taxonomy,filters), total=results.length;
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));page=Math.min(page,pages);
  $('result-count').textContent=`${total.toLocaleString()} ${total===1?'problem':'problems'}${total<data.problems.length?' found':''}`;
  const list=$('problem-list');list.setAttribute('aria-busy','false');
  const shown=results.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  if(total)list.replaceChildren(...shown.map(problemCard));
  else{const e=node('div','empty-state');e.append(node('span','empty-symbol','∅'),node('h3',null,'No problems in this selection.'),node('p',null,'Try fewer method tags, Match any, or a wider year range.'));const b=node('button','outline-button','Clear all filters');b.type='button';b.addEventListener('click',reset);e.append(b);list.replaceChildren(e);}
  const pagination=$('pagination');pagination.replaceChildren();
  if(pages>1){
    const previous=node('button','outline-button','← Previous');previous.type='button';previous.disabled=page===1;
    const next=node('button','outline-button','Next →');next.type='button';next.disabled=page===pages;
    previous.addEventListener('click',()=>changePage(page-1));next.addEventListener('click',()=>changePage(page+1));
    pagination.append(previous,node('span',null,`Page ${page} of ${pages}`),next);
  }
}
function changePage(value){page=value;render();$('results').scrollIntoView({behavior:'smooth',block:'start'});}
function reset(){filters={query:'',contest:'',subject:'',from:'',to:'',evidence:'',tags:[],mode:'AND',problem:''};page=1;$('tag-search').value='';syncControls();render();}
async function copyUrl(url,button){
  try{await navigator.clipboard.writeText(url);const text=button.textContent;button.textContent='Link copied ✓';setTimeout(()=>button.textContent=text,2000);}
  catch{button.textContent='Copy the URL from your address bar';history.replaceState(null,'',url);}
}
function renderCoverage(){
  const contents=$('coverage-content');contents.append(node('p',null,data.scope));
  for(const c of data.coverage){contents.append(node('h3',null,c.title),node('p',null,c.text));}
  const ul=node('ul');for(const c of data.caveats)ul.append(node('li',null,c));contents.append(ul);
  contents.append(node('p','muted','Classification notes are original summaries. Full statements and solutions stay with their linked sources. “Forum checked” records a review outcome; it does not certify every forum proof.'));
}
async function start(){
  try{
    const response=await fetch('./data/catalogue.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);data=await response.json();
    tags=new Map(data.taxonomy.map(t=>[t.id,t]));filters=readFilters();
    $('total-stat').textContent=data.problems.length.toLocaleString();
    $('updated').textContent='Snapshot · '+new Intl.DateTimeFormat('en',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(data.updated));
    const years=[...new Set(data.problems.map(p=>p.year))].sort((a,b)=>b-a);
    for(const id of ['from-year','to-year'])for(const year of years){const option=node('option',null,year);option.value=year;$(id).append(option);}
    // Preserve a valid boundary year even when the current snapshot has no entries in that year.
    for(const [id,key]of[['from-year','from'],['to-year','to']])if(filters[key]&&!years.includes(Number(filters[key]))){if(/^\d{4}$/.test(filters[key])){const o=node('option',null,filters[key]);o.value=filters[key];$(id).append(o);}else filters[key]='';}
    syncControls();renderCoverage();
    for(const [id,key]of[['search','query'],['contest','contest'],['subject','subject'],['evidence','evidence'],['from-year','from'],['to-year','to']]) $(id).addEventListener(id==='search'?'input':'change',()=>{filters[key]=$(id).value;filters.problem='';page=1;render();});
    $('tag-search').addEventListener('input',renderTags);
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{filters.mode=b.dataset.mode;page=1;syncControls();render();}));
    $('reset').addEventListener('click',reset);$('copy-link').addEventListener('click',()=>copyUrl(location.href,$('copy-link')));
    $('coverage-open').addEventListener('click',()=>$('coverage-dialog').showModal());$('coverage-close').addEventListener('click',()=>$('coverage-dialog').close());
    window.addEventListener('popstate',()=>{filters=readFilters();page=1;syncControls();render();});
    render();
  }catch(error){
    $('result-count').textContent='Catalogue unavailable';$('problem-list').setAttribute('aria-busy','false');
    const box=node('div','empty-state');box.append(node('h3',null,'The catalogue could not load.'),node('p',null,'Check your connection and try again.'));
    const b=node('button','outline-button','Retry');b.type='button';b.addEventListener('click',()=>location.reload());box.append(b);$('problem-list').replaceChildren(box);console.error('Catalogue load failed:',error);
  }
}
start();
