// Light / dark mode switch for every page: a small hanging lamp at the top right of the header.
// Lamp on = light mode, lamp off = dark mode. The choice is remembered (localStorage); until the reader picks one,
// the page follows the system setting. Loaded as a plain script in <head> so the saved theme applies before
// the first paint (no flash). Stylesheets read <html data-theme="light|dark">.
(() => {
  const KEY = 'raindrops-theme', root = document.documentElement;
  const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.dataset.theme || (system.matches ? 'dark' : 'light');

  const STYLE = `
.theme-lamp{position:relative;z-index:45;flex:none;width:30px;height:44px;margin:-8px 0 -8px auto;padding:0;border:0;background:none;color:var(--fg);cursor:pointer;-webkit-tap-highlight-color:transparent}
.site-header .account:not([hidden])~.theme-lamp{margin-left:6px}
.theme-lamp svg{display:block;width:30px;height:44px;overflow:visible}
.theme-lamp .lamp-sway{transform-origin:15px 0;transition:transform .5s cubic-bezier(.3,1.6,.5,1)}
.theme-lamp:hover .lamp-sway{transform:rotate(-5deg)}
.theme-lamp .lamp-shade{fill:currentColor}
.theme-lamp .lamp-bulb{fill:var(--bg);stroke:currentColor;stroke-width:1.2;transition:fill .25s ease}
.theme-lamp .lamp-glow{fill:#ffd666;opacity:0;transition:opacity .35s ease}
.theme-lamp .lamp-beam{fill:url(#lamp-beam);opacity:0;transition:opacity .35s ease}
.theme-lamp .lamp-pull{transition:transform .18s ease-out}
.theme-lamp.is-pulled .lamp-pull{transform:translateY(5px)}
:root[data-lamp=on] .theme-lamp .lamp-bulb{fill:#ffd666;stroke:#e0a800}
:root[data-lamp=on] .theme-lamp .lamp-glow{opacity:.55}
:root[data-lamp=on] .theme-lamp .lamp-beam{opacity:1}
.theme-lamp:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:4px}
:root.theme-fade,:root.theme-fade *,:root.theme-fade *::before,:root.theme-fade *::after{transition:background-color .35s ease,color .35s ease,border-color .35s ease,fill .35s ease,stroke .35s ease!important}
@media(prefers-reduced-motion:reduce){.theme-lamp *{transition:none!important}:root.theme-fade *{transition:none!important}}
`;
  const SVG = `<svg viewBox="0 0 30 44" aria-hidden="true" focusable="false">
  <defs><radialGradient id="lamp-beam" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#ffd666" stop-opacity=".45"/><stop offset="1" stop-color="#ffd666" stop-opacity="0"/></radialGradient></defs>
  <g class="lamp-sway">
    <path d="M15 0V14" stroke="currentColor" stroke-width="1.2"/>
    <path class="lamp-beam" d="M8.5 26L1 44H29L21.5 26Z"/>
    <circle class="lamp-glow" cx="15" cy="26.5" r="7"/>
    <path class="lamp-shade" d="M12.5 14H17.5L22.5 25.5H7.5Z"/>
    <circle class="lamp-bulb" cx="15" cy="26.5" r="3"/>
    <g class="lamp-pull"><path d="M22 25.5V34" stroke="currentColor" stroke-width=".9"/><circle cx="22" cy="35" r="1.4" fill="currentColor"/></g>
  </g>
</svg>`;

  function sync(button) {
    const dark = current() === 'dark';
    root.dataset.lamp = dark ? 'off' : 'on';
    if (!button) return;
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.title = dark ? 'Turn the lamp on (light mode)' : 'Turn the lamp off (dark mode)';
    button.setAttribute('aria-pressed', String(!dark));
  }
  sync();

  function mount() {
    const header = document.querySelector('.site-header');
    if (!header || header.querySelector('.theme-lamp')) return;
    const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'theme-lamp'; button.innerHTML = SVG;
    header.append(button);
    sync(button);
    let pullTimer = null, fadeTimer = null;
    button.addEventListener('click', () => {
      // pull the cord, then switch: the page eases into the new colours
      button.classList.add('is-pulled'); clearTimeout(pullTimer);
      pullTimer = setTimeout(() => button.classList.remove('is-pulled'), 180);
      const next = current() === 'dark' ? 'light' : 'dark';
      root.classList.add('theme-fade'); clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), 400);
      root.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch { /* private mode: this visit only */ }
      sync(button);
    });
    // Follow the system setting while the reader hasn't chosen one.
    system.addEventListener?.('change', () => sync(button));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
