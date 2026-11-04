import {problemName} from './catalogue-core.mjs?v=20261103-names';

let statementsPromise, mathPromise, currentKey;
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function externalLink(label, url) {
  const link = element('a', label);
  try { if (new URL(url).protocol !== 'https:') return null; } catch { return null; }
  link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}
function image(src, alt) {
  let url;
  try { url = new URL(src); } catch { return null; }
  if (url.protocol !== 'https:' || !/(^|\.)artofproblemsolving\.com$/.test(url.hostname)) return null;
  const img = element('img'); img.src = url.href; img.alt = alt || 'Problem diagram'; img.loading = 'lazy';
  return img;
}
function appendStatementText(parent, text) {
  // Render proposer credits as emphasis, including credits already wrapped in Markdown.
  const credits = /^[ \t]*[*_]{0,2}[Pp]roposed\b[^\n]*|(?<=[\s$\]}])[*_]{0,2}Proposed\b[^\n]*/gm;
  let position = 0;
  for (const match of text.matchAll(credits)) {
    parent.append(document.createTextNode(text.slice(position, match.index)));
    const credit = match[0].trim().replace(/^[*_]+|[*_]+$/g, '').trim();
    parent.append(element('em', credit.endsWith('.') ? credit : `${credit}.`));
    position = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(position)));
}
function statementBody(statement) {
  const body = element('div', null, 'statement-text');
  const text = statement.text.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
  // Keep forum text inert. Only archived Markdown image references get special handling.
  const pattern = /!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    appendStatementText(body, text.slice(position, match.index));
    const img = image(match[2], match[1]);
    body.append(img || document.createTextNode(match[0]));
    position = match.index + match[0].length;
  }
  appendStatementText(body, text.slice(position));
  for (const item of statement.images || []) { const img = image(item.src, item.alt); if (img) body.append(img); }
  return body;
}
function loadMath() {
  if (!mathPromise) mathPromise = new Promise((resolve, reject) => {
    window.MathJax = {
      loader: {load:['ui/safe']},
      tex: {inlineMath:[['$','$'],['\\(','\\)']], displayMath:[['$$','$$'],['\\[','\\]']], processEscapes:true},
      svg: {fontCache:'local'}, startup: {typeset:false},
      options: {safeOptions:{safeProtocols:{https:true, http:false, file:false, javascript:false, data:false}}}
    };
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
    script.onload = () => window.MathJax.startup.promise.then(resolve, reject);
    script.onerror = () => reject(new Error('Math renderer unavailable'));
    document.head.append(script);
  });
  return mathPromise;
}
export async function renderStatement(panel, problem) {
  const key = problem?.key || '';
  if (key === currentKey) return;
  currentKey = key;
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([panel]);
  panel.replaceChildren(); panel.hidden = !problem;
  if (!problem) return;
  const title = element('h2', `${problemName(problem)} — Problem statement`);
  panel.append(title, element('p', 'Loading statement…', 'statement-source'));
  try {
    if (!statementsPromise) statementsPromise = fetch('./data/statements.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(error => { statementsPromise = null; throw error; });
    const data = await statementsPromise;
    if (currentKey !== key) return;
    const statement = data.statements[key];
    panel.replaceChildren(title);
    if (!statement) {
      panel.append(element('p', 'The statement has not been collected for this entry yet.'));
      const source = externalLink('Read the original source', problem.aopsUrl || problem.officialUrl);
      if (source) panel.append(source);
      return;
    }
    const body = statementBody(statement);
    panel.append(body);
    try {
      await loadMath();
      if (currentKey === key && body.isConnected) await window.MathJax.typesetPromise([body]);
    } catch {
      if (currentKey === key) panel.append(element('p', 'Math typesetting is unavailable; the original LaTeX is shown.', 'statement-source'));
    }
  } catch {
    if (currentKey !== key) return;
    panel.replaceChildren(title, element('p', 'The saved statement could not be loaded.'));
    const link = externalLink('Read the original source', problem.aopsUrl || problem.officialUrl);
    if (link) panel.append(link);
  }
}
