// Read an official solutions PDF as text inside the browser (no download).
// 1. Navigate a tab to the PDF's own site, e.g. https://www.imo-official.org/problems/IMO2016SL.pdf
//    (2006–2024; 2025 is at /assets/documents/problems/2025/IMO2025SL.pdf). Older years: the IMO Compendium,
//    https://mathematicalolympiads.wordpress.com/wp-content/uploads/2012/08/imo-compendium.pdf
//    (the imomath.com 2001–2003 booklets are image scans with no text layer).
// 2. Paste this file via javascript_exec, then:
//      await __loadU(location.href)            -> loads the PDF text (fetch must be same-origin)
//      __brief(['G6','G7'])                    -> for G6: segment length, Solution/Comment positions,
//                                                 and positions of analytic keywords
//      __seg('G6','G7').slice(2800, 4300)     -> read part of the G6 section
// The PDF text drops some letters ("ir le" = circle, "Sine" can be "Since"), and spaces are removed.
window.__c=s=>s.replace(/=/g,'＝').replace(/;/g,'；').replace(/&/g,'＆').replace(/\?/g,'？');
window.__lib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
__lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
window.__KW=/omplexn|omplexplane|omplexoord|oordinat|arycentr|rigonometr|artesian|vetors?\b|vectors?\b|lawofsines|lawofosines|osine|\bcos|sin∠|sin\(|sinα|sinβ|sinγ|tan\(|tanα|bash/gi;
window.__loadU=async(u)=>{const r=await fetch(u);if(!r.ok)return 'HTTP '+r.status;const doc=await __lib.getDocument({data:await r.arrayBuffer()}).promise;const pages=[];for(let i=1;i<=doc.numPages;i++){const tc=await (await doc.getPage(i)).getTextContent();pages.push(tc.items.map(x=>x.str).join(' '))}window.__pdf=pages;window.__full=pages.map(p=>p.replace(/\s+/g,'')).join(' ');return u+': '+doc.numPages+' pages'};
// Section of label `lab` in the solutions part (last occurrence of "G6."), up to the next label.
window.__seg=(lab,next)=>{const re=new RegExp(lab+'\\.','g');let m,idx=[];while((m=re.exec(__full)))idx.push(m.index);const st=idx[idx.length-1];let en=next?__full.indexOf(next+'.',st+5):-1;if(en<0)en=Math.min(__full.length,st+30000);return __full.slice(st,en)};
window.__brief=(labs)=>labs.slice(0,-1).map((l,i)=>{const t=__seg(l,labs[i+1]);const heads=[...t.matchAll(/(Solution\d?\.|Comment\d?\.)/g)].map(h=>h[0]+'@'+h.index);const kw=[...t.matchAll(__KW)].map(k=>k[0]+'@'+k.index);return __c(l+' len'+t.length+' | '+heads.join(' ')+' | KW '+kw.join(','))});
'pdf helpers loaded'
