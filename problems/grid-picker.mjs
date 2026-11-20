import {matchingCollections} from './statement-catalogue.mjs?v=20261119-tstst';

export function createGridPicker(host, options, onSelect) {
  const search = host.querySelector('input'), list = host.querySelector('[data-grid-options]');
  const status = host.querySelector('[role=status]');
  const prev = host.querySelector('[data-grid-scroll=previous]');
  const next = host.querySelector('[data-grid-scroll=next]');
  let selected = options[0]?.id;
  const scrollState = () => {
    const overflow = list.scrollWidth > list.clientWidth + 2;
    prev.hidden = next.hidden = !overflow;
    prev.disabled = list.scrollLeft < 2;
    next.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
  };
  const choose = id => { selected = id; onSelect(id); };
  const draw = () => {
    const found = matchingCollections(options, search.value);
    const buttons = found.map(o => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.grid = o.id;
      b.textContent = o.label; b.title = `${o.label} · ${o.count.toLocaleString()} problems`;
      b.setAttribute('aria-pressed', String(o.id === selected));
      b.addEventListener('click', () => choose(o.id));
      b.addEventListener('keydown', e => {
        const index = found.findIndex(o => o.id === b.dataset.grid);
        const move = e.key === 'ArrowRight' ? Math.min(index+1, found.length-1)
          : e.key === 'ArrowLeft' ? Math.max(0,index-1) : e.key === 'Home' ? 0
          : e.key === 'End' ? found.length-1 : null;
        if (move == null) return;
        e.preventDefault(); const target = list.children[move]; target.focus();
        target.scrollIntoView({block:'nearest', inline:'nearest'});
      });
      return b;
    });
    list.replaceChildren(...buttons);
    status.textContent = found.length ? '' : 'No collections match.';
    requestAnimationFrame(scrollState);
  };
  search.addEventListener('input', draw);
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { search.value = ''; draw(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector('button')?.focus(); }
    else if (e.key === 'Enter') {
      e.preventDefault(); const found = matchingCollections(options, search.value);
      if (found.length === 1) choose(found[0].id);
    }
  });
  for (const [button, direction] of [[prev,-1],[next,1]]) button.addEventListener('click', () =>
    list.scrollBy({left:direction*Math.max(160,list.clientWidth*.75),
      behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}));
  list.addEventListener('scroll', scrollState, {passive:true});
  new ResizeObserver(scrollState).observe(list);
  draw();
  return {setSelected(id) {
    selected = id;
    for (const b of list.children) b.setAttribute('aria-pressed', String(b.dataset.grid === id));
    scrollState();
  }};
}
