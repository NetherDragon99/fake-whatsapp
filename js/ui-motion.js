// Shared motion helpers: menus that grow from their trigger, sheets, overlays
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function afterAnimation(el, className, fallbackMs, done) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener('animationend', onEnd);
    done();
  };
  const onEnd = (e) => {
    if (e.target === el) finish();
  };
  el.addEventListener('animationend', onEnd);
  setTimeout(finish, fallbackMs);
}

export const Motion = {
  reduced: reduceMotion,

  /** Open a dropdown so it visibly grows out of the anchor button (e.g. the 3 dots). */
  openMenu(menu, anchor) {
    if (!menu) return;
    menu.classList.remove('menu-closing');
    if (anchor) {
      const a = anchor.getBoundingClientRect();
      const parent = menu.offsetParent || menu.parentElement;
      const p = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
      menu.style.display = 'block';
      const m = menu.getBoundingClientRect();
      const ox = a.left + a.width / 2 - m.left;
      const oy = a.top + a.height / 2 - m.top;
      menu.style.transformOrigin = `${Math.round(ox)}px ${Math.round(oy)}px`;
      void p;
    } else {
      menu.style.display = 'block';
    }
    menu.classList.remove('menu-opening');
    void menu.offsetWidth;
    menu.classList.add('menu-opening');
    menu.dataset.open = '1';
  },

  /** Close a dropdown by shrinking it back into the anchor. */
  closeMenu(menu) {
    if (!menu || menu.style.display === 'none' || menu.dataset.open !== '1') {
      if (menu) menu.style.display = 'none';
      return;
    }
    menu.dataset.open = '0';
    menu.classList.remove('menu-opening');
    menu.classList.add('menu-closing');
    afterAnimation(menu, 'menu-closing', 260, () => {
      if (menu.dataset.open === '0') {
        menu.style.display = 'none';
        menu.classList.remove('menu-closing');
      }
    });
  },

  isMenuOpen(menu) {
    return !!menu && menu.dataset.open === '1' && menu.style.display !== 'none';
  },

  /** Show an overlay element that has a nested sheet (context action sheet). */
  openSheet(overlay, display = 'flex') {
    if (!overlay) return;
    overlay.classList.remove('sheet-closing');
    overlay.style.display = display;
    overlay.classList.remove('sheet-opening');
    void overlay.offsetWidth;
    overlay.classList.add('sheet-opening');
    overlay.dataset.open = '1';
  },

  closeSheet(overlay) {
    if (!overlay) return;
    if (overlay.style.display === 'none' || overlay.dataset.open !== '1') {
      overlay.style.display = 'none';
      return;
    }
    overlay.dataset.open = '0';
    overlay.classList.remove('sheet-opening');
    overlay.classList.add('sheet-closing');
    afterAnimation(overlay, 'sheet-closing', 260, () => {
      if (overlay.dataset.open === '0') {
        overlay.style.display = 'none';
        overlay.classList.remove('sheet-closing');
      }
    });
  },

  /** Animate an element out and remove it. */
  removeWithAnimation(el, className = 'overlay-closing', ms = 220) {
    if (!el || !el.parentNode) return;
    el.classList.add(className);
    setTimeout(() => el.remove(), ms);
  }
};
