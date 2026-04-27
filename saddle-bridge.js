// Saddle bridge — drop this into your design system's main entry to enable Saddle's
// Element Inspector and live token edits.
//
// Usage:
//   1. Copy this file into your project (e.g. src/saddle-bridge.js or demo/saddle-bridge.js).
//   2. In your entry file (main.tsx / index.tsx) add:
//
//        import './saddle-bridge';
//
//   3. (Optional) Set window.SADDLE_ROOT_SELECTOR before this file runs to point at a
//      specific root node. Defaults to '#root'.
//
// Embed mode:
//   Saddle appends `?embed=1` to the iframe URL. Your demo entry should detect this flag
//   and render only the selected component (read the component slug from
//   `window.location.hash`) without nav/header/footer chrome. Without that branch, your
//   full demo page renders inside Saddle — still functional, just not focused.
//
//   Example:
//     const embed = new URLSearchParams(location.search).get('embed') === '1';
//     if (embed) return <YourStoryProvider><Story /></YourStoryProvider>;
//
// Saddle <-> iframe message types:
//
//   Saddle -> iframe:
//     { type: 'saddle:scan' }                       — request a fresh DOM tree
//     { type: 'saddle:select', path: number[] }     — programmatically select an element
//                                                     (highlights + posts back its styles)
//     { type: 'saddle:highlight', path: number[] }  — highlight without selecting (hover)
//     { type: 'saddle:clear-highlight' }            — remove the overlay
//     { type: 'saddle:set-tokens', tokens: {} }     — apply { '--var': 'value' } to :root
//     { type: 'saddle:set-element-styles', path, styles } — apply CSS props inline to one element
//     { type: 'saddle:set-element-state', path, state }   — force default/hover/focus/active/disabled
//                                                           on the element (best-effort)
//
//   iframe -> Saddle:
//     { type: 'saddle:tree', tree }                 — full serialised DOM tree
//     { type: 'saddle:element', path, styles }      — selected element + its computed styles
//     { type: 'saddle:hello' }                      — handshake on bridge install
//
// Path format: array of child indices from the root. e.g. [0, 2, 1] is
//   root.children[0].children[2].children[1]

(function () {
  if (typeof window === 'undefined') return;
  if (window.__SADDLE_BRIDGE_INSTALLED__) return;
  window.__SADDLE_BRIDGE_INSTALLED__ = true;

  var ROOT_SELECTOR = window.SADDLE_ROOT_SELECTOR || '#root';

  function getRoot() {
    return document.querySelector(ROOT_SELECTOR) || document.body;
  }

  function pathToElement(path) {
    var el = getRoot();
    if (!Array.isArray(path)) return null;
    for (var i = 0; i < path.length; i++) {
      if (!el || !el.children[path[i]]) return null;
      el = el.children[path[i]];
    }
    return el;
  }

  function elementToPath(target) {
    var path = [];
    var el = target;
    var root = getRoot();
    while (el && el !== root) {
      var parent = el.parentElement;
      if (!parent) return null;
      var idx = Array.prototype.indexOf.call(parent.children, el);
      if (idx === -1) return null;
      path.unshift(idx);
      el = parent;
    }
    return path;
  }

  function serializeNode(el) {
    if (!(el instanceof Element)) return null;
    var node = {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: el.className && typeof el.className === 'string'
        ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 6)
        : undefined,
      text: undefined,
      children: [],
    };
    for (var i = 0; i < el.childNodes.length; i++) {
      var child = el.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE && child.textContent && child.textContent.trim()) {
        node.text = child.textContent.trim().slice(0, 40);
        break;
      }
    }
    for (var j = 0; j < el.children.length; j++) {
      var c = serializeNode(el.children[j]);
      if (c) node.children.push(c);
    }
    return node;
  }

  var STYLE_PROPS = [
    'background-color', 'color', 'border', 'border-radius',
    'border-color', 'border-width', 'border-style',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'padding-inline', 'padding-block',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing',
    'text-align', 'text-transform',
    'gap', 'row-gap', 'column-gap',
    'display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'box-shadow', 'opacity', 'cursor',
    'position', 'top', 'right', 'bottom', 'left', 'z-index',
  ];

  function getStyles(el) {
    if (!el) return {};
    var cs = getComputedStyle(el);
    var out = {};
    for (var i = 0; i < STYLE_PROPS.length; i++) {
      var p = STYLE_PROPS[i];
      var v = cs.getPropertyValue(p);
      if (v) out[p] = v.trim();
    }
    return out;
  }

  // Highlight overlay
  var overlay = null;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = '__saddle_overlay__';
    overlay.style.cssText =
      'position:fixed;z-index:2147483646;pointer-events:none;' +
      'outline:1.5px solid #007AFF;outline-offset:2px;' +
      'background:transparent;border-radius:2px;' +
      'transition:all 80ms ease;display:none;box-sizing:border-box;';
    document.body.appendChild(overlay);
    return overlay;
  }
  function setHighlight(el) {
    var o = ensureOverlay();
    if (!el || !(el instanceof Element)) {
      o.style.display = 'none';
      return;
    }
    var r = el.getBoundingClientRect();
    o.style.display = 'block';
    o.style.top = r.top + 'px';
    o.style.left = r.left + 'px';
    o.style.width = r.width + 'px';
    o.style.height = r.height + 'px';
  }

  function postParent(msg) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  }

  function sendTree() {
    postParent({ type: 'saddle:tree', tree: serializeNode(getRoot()) });
  }

  function sendElement(path) {
    var el = pathToElement(path);
    if (!el) return;
    setHighlight(el);
    postParent({
      type: 'saddle:element',
      path: path,
      styles: getStyles(el),
    });
  }

  // Apply token CSS variables sent by Saddle
  function applyTokens(tokens) {
    if (!tokens) return;
    var root = document.documentElement;
    Object.keys(tokens).forEach(function (key) {
      var prop = key.indexOf('--') === 0 ? key : '--' + key;
      root.style.setProperty(prop, tokens[key]);
    });
  }

  // camelCase → kebab-case for CSS property names
  function toKebab(s) {
    return s.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
  }

  // Force a UI state on a single element. Pseudo-classes (`:hover`, `:active`)
  // can't be triggered programmatically in iframes, so we approximate:
  //   - focus    → el.focus()
  //   - disabled → set the `disabled` attribute / property
  //   - hover    → dispatch mouseover/mouseenter/pointerover/pointerenter
  //   - active   → dispatch mousedown/pointerdown
  //   - default  → reset everything we touched
  // Components that drive state via JS event handlers (Radix, framer-motion, etc.)
  // will reflect this; components relying purely on CSS pseudo-classes won't.
  function fire(el, types) {
    types.forEach(function (t) {
      try {
        el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
      } catch (err) {
        /* ignore unsupported event types */
      }
    });
  }
  function setElementState(path, state) {
    var el = pathToElement(path);
    if (!el || !(el instanceof HTMLElement)) return;
    // Always reset first so state changes are clean
    el.removeAttribute('data-saddle-state');
    if ('disabled' in el) el.disabled = false;
    el.removeAttribute('disabled');
    fire(el, ['mouseleave', 'mouseout', 'mouseup', 'pointerleave', 'pointerout', 'pointerup']);
    try { el.blur(); } catch (e) {}
    if (!state || state === 'default') return;
    el.setAttribute('data-saddle-state', state);
    if (state === 'focus') {
      try { el.focus(); } catch (e) {}
    } else if (state === 'disabled') {
      el.setAttribute('disabled', '');
      if ('disabled' in el) el.disabled = true;
    } else if (state === 'hover') {
      fire(el, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']);
    } else if (state === 'active') {
      fire(el, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointerdown', 'mousedown']);
    }
  }

  // Apply per-element inline style overrides sent by Saddle.
  // We use !important so the override wins against any matching CSS rule
  // (most design systems use plain selectors without !important, but the
  // inline-vs-class specificity isn't always enough — !important guarantees it).
  function applyElementStyles(path, styles) {
    var el = pathToElement(path);
    if (!el || !(el instanceof HTMLElement)) {
      console.warn('[saddle-bridge] no element at path', path);
      return;
    }
    Object.keys(styles).forEach(function (key) {
      var prop = key.indexOf('-') === -1 ? toKebab(key) : key;
      var value = styles[key];
      if (value === '' || value == null) {
        el.style.removeProperty(prop);
      } else {
        el.style.setProperty(prop, String(value), 'important');
      }
    });
  }

  // Listen for messages from Saddle
  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'saddle:scan':
        sendTree();
        break;
      case 'saddle:select':
        sendElement(msg.path || []);
        break;
      case 'saddle:highlight':
        setHighlight(pathToElement(msg.path || []));
        break;
      case 'saddle:clear-highlight':
        setHighlight(null);
        break;
      case 'saddle:set-tokens':
        applyTokens(msg.tokens);
        break;
      case 'saddle:set-element-styles':
        applyElementStyles(msg.path || [], msg.styles || {});
        break;
      case 'saddle:set-element-state':
        setElementState(msg.path || [], msg.state);
        break;
    }
  });

  // Element clicks in the iframe → tell Saddle (Cmd-click on macOS / Ctrl-click on others
  // to avoid intercepting normal interaction).
  function inspectModifier(e) {
    return e.metaKey || e.ctrlKey;
  }

  document.addEventListener(
    'click',
    function (e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      if (inspectModifier(e)) {
        var path = elementToPath(t);
        if (path) {
          e.preventDefault();
          e.stopPropagation();
          sendElement(path);
        }
        return;
      }
      // Plain click on a non-interactive area → deselect. We treat anything that isn't
      // (or doesn't sit inside) a button/link/form control as canvas whitespace.
      var interactive = 'button, a, input, select, textarea, label, [role="button"], [role="link"], [role="textbox"], [contenteditable="true"]';
      if (!t.closest || !t.closest(interactive)) {
        postParent({ type: 'saddle:deselect' });
      }
    },
    true
  );

  // Hover preview (Cmd held) → highlight only
  document.addEventListener('mousemove', function (e) {
    if (!inspectModifier(e)) {
      setHighlight(null);
      return;
    }
    var t = e.target;
    if (!(t instanceof Element)) return;
    setHighlight(t);
  });

  // Auto-rescan tree on DOM changes (debounced)
  var mutateTimer;
  var observer = new MutationObserver(function () {
    clearTimeout(mutateTimer);
    mutateTimer = setTimeout(sendTree, 200);
  });

  function start() {
    sendTree();
    postParent({ type: 'saddle:hello' });
    observer.observe(getRoot(), { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
