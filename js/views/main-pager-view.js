// Main ViewPager: Unified 3-tab Swipe Pager for Chats, Calls, and Settings
import { HomeView } from './home-view.js';
import { CallsView } from './calls-view.js';
import { SettingsView } from './settings-view.js';
import { Icons } from '../icons.js';

export class MainPagerView {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.viewport = null;
    this.bottomNav = null;
    this.isMainPager = true;
    this.currentIndex = 0; // 0: chats, 1: calls, 2: settings
    this.tabs = ['chats', 'calls', 'settings'];
    this.tabHashes = ['#/chats', '#/calls', '#/settings'];
    this.homeView = null;
    this.callsView = null;
    this.settingsView = null;
    this.isScrollingProgrammatically = false;
    this.programmaticScrollTimeout = null;
    this.scrollTimeout = null;
    this.resizeHandler = null;

    // Mouse drag support for desktop testing
    this.isMouseDown = false;
    this.mouseStartX = 0;
    this.mouseStartScrollLeft = 0;
    this.mouseMoved = false;
    this.onMouseMove = null;
    this.onMouseUp = null;
  }

  get isSelectionMode() {
    return Boolean(this.homeView && this.homeView.isSelectionMode);
  }

  exitSelectionMode() {
    if (this.homeView && typeof this.homeView.exitSelectionMode === 'function') {
      this.homeView.exitSelectionMode();
    }
  }

  async render(rootEl, params = {}) {
    this.container = rootEl;
    const initialTab = params.initialTab || (window.location.hash.startsWith('#/calls') ? 'calls' : (window.location.hash.startsWith('#/settings') ? 'settings' : 'chats'));
    const tabIdx = this.tabs.indexOf(initialTab);
    this.currentIndex = tabIdx !== -1 ? tabIdx : 0;

    rootEl.innerHTML = `
      <div class="main-pager-container" id="main-pager-root">
        <div class="main-pager-viewport" id="main-pager-viewport">
          <div class="main-pager-page" id="pager-page-chats" data-index="0" data-tab="chats"></div>
          <div class="main-pager-page" id="pager-page-calls" data-index="1" data-tab="calls"></div>
          <div class="main-pager-page" id="pager-page-settings" data-index="2" data-tab="settings"></div>
        </div>

        <!-- Persistent Bottom Navigation Bar (Material 3 with Pill Indicator) -->
        <nav class="wa-bottom-nav" id="main-pager-bottom-nav">
          <a href="#/chats" class="nav-tab ${this.currentIndex === 0 ? 'active' : ''}" data-index="0" data-tab="chats">
            <div class="tab-icon-wrap">
              <span class="tab-pill-indicator"></span>
              ${Icons.chatsTab('', 22)}
            </div>
            <span class="tab-label">Chats</span>
          </a>
          <a href="#/calls" class="nav-tab ${this.currentIndex === 1 ? 'active' : ''}" data-index="1" data-tab="calls">
            <div class="tab-icon-wrap">
              <span class="tab-pill-indicator"></span>
              ${Icons.callsTab('', 22)}
            </div>
            <span class="tab-label">Calls</span>
          </a>
          <a href="#/settings" class="nav-tab ${this.currentIndex === 2 ? 'active' : ''}" data-index="2" data-tab="settings">
            <div class="tab-icon-wrap">
              <span class="tab-pill-indicator"></span>
              ${Icons.settingsTab('', 22)}
            </div>
            <span class="tab-label">Settings</span>
          </a>
        </nav>
      </div>
    `;

    this.viewport = rootEl.querySelector('#main-pager-viewport');
    this.bottomNav = rootEl.querySelector('#main-pager-bottom-nav');

    // Instantiate sub-views
    this.homeView = new HomeView(this.router);
    this.callsView = new CallsView(this.router);
    this.settingsView = new SettingsView(this.router);

    const pageChats = rootEl.querySelector('#pager-page-chats');
    const pageCalls = rootEl.querySelector('#pager-page-calls');
    const pageSettings = rootEl.querySelector('#pager-page-settings');

    // Render all 3 views into their respective page slots in parallel
    await Promise.all([
      this.homeView.render(pageChats).catch((err) => console.error('[MainPagerView] Error rendering HomeView:', err)),
      this.callsView.render(pageCalls).catch((err) => console.error('[MainPagerView] Error rendering CallsView:', err)),
      this.settingsView.render(pageSettings).catch((err) => console.error('[MainPagerView] Error rendering SettingsView:', err))
    ]);

    this.bindEvents();

    // Scroll to initial tab on next animation frame after layout calculation
    requestAnimationFrame(() => {
      this.scrollToIndex(this.currentIndex, false);
    });
  }

  bindEvents() {
    if (!this.viewport || !this.bottomNav) return;

    // Bottom Navigation tab clicks
    this.bottomNav.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(tab.dataset.index, 10);
        if (!isNaN(index)) {
          this.scrollToIndex(index, true);
          this.router.syncTab(this.tabHashes[index]);
          this.onTabActivated(index);
        }
      });
    });

    // Fluid scroll listener on viewport: tracks swipe position in real-time
    const handleScroll = () => {
      if (this.isScrollingProgrammatically) return;

      const width = this.viewport.clientWidth;
      if (!width) return;

      const rawIndex = this.viewport.scrollLeft / width;
      const nearestIndex = Math.min(Math.max(Math.round(rawIndex), 0), this.tabs.length - 1);

      if (nearestIndex !== this.currentIndex) {
        this.currentIndex = nearestIndex;
        this.updateBottomNav(nearestIndex);
        this.router.syncTab(this.tabHashes[nearestIndex]);
        this.onTabActivated(nearestIndex);
      }

      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        const finalWidth = this.viewport.clientWidth;
        if (!finalWidth) return;
        const finalIndex = Math.min(Math.max(Math.round(this.viewport.scrollLeft / finalWidth), 0), this.tabs.length - 1);
        if (finalIndex !== this.currentIndex) {
          this.currentIndex = finalIndex;
          this.updateBottomNav(finalIndex);
          this.router.syncTab(this.tabHashes[finalIndex]);
          this.onTabActivated(finalIndex);
        }
      }, 120);
    };

    this.viewport.addEventListener('scroll', handleScroll, { passive: true });

    if ('onscrollend' in window) {
      this.viewport.addEventListener('scrollend', handleScroll, { passive: true });
    }

    // Orientation / window resize listener
    this.resizeHandler = () => {
      if (this.viewport && this.viewport.clientWidth > 0) {
        this.viewport.scrollTo({
          left: this.currentIndex * this.viewport.clientWidth,
          behavior: 'auto'
        });
      }
    };
    window.addEventListener('resize', this.resizeHandler);

    // Desktop mouse drag support
    this.viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // Don't drag if clicking buttons, inputs, links, or cards
      if (e.target.closest('button, a, input, textarea, select, .chat-list-item, .call-list-item, .filter-chip, .settings-profile-card, .settings-nav-row')) {
        return;
      }
      this.isMouseDown = true;
      this.mouseMoved = false;
      this.mouseStartX = e.clientX;
      this.mouseStartScrollLeft = this.viewport.scrollLeft;
      this.viewport.style.scrollBehavior = 'auto';
      this.viewport.style.scrollSnapType = 'none';
      this.viewport.style.cursor = 'grabbing';
    });

    this.onMouseMove = (e) => {
      if (!this.isMouseDown) return;
      const dx = e.clientX - this.mouseStartX;
      if (Math.abs(dx) > 4) this.mouseMoved = true;
      this.viewport.scrollLeft = this.mouseStartScrollLeft - dx;
    };

    this.onMouseUp = () => {
      if (!this.isMouseDown) return;
      this.isMouseDown = false;
      this.viewport.style.scrollSnapType = 'x mandatory';
      this.viewport.style.scrollBehavior = 'smooth';
      this.viewport.style.cursor = '';
      if (this.mouseMoved) {
        const width = this.viewport.clientWidth;
        if (width > 0) {
          const nearest = Math.min(Math.max(Math.round(this.viewport.scrollLeft / width), 0), this.tabs.length - 1);
          this.scrollToIndex(nearest, true);
          this.router.syncTab(this.tabHashes[nearest]);
          this.onTabActivated(nearest);
        }
      }
    };

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    // Selection mode lock bridge
    window.setPagerSwipeEnabled = (enabled) => {
      if (this.viewport) {
        this.viewport.style.overflowX = enabled ? 'auto' : 'hidden';
        this.viewport.style.scrollSnapType = enabled ? 'x mandatory' : 'none';
        this.viewport.style.touchAction = enabled ? 'pan-x pan-y' : 'pan-y';
      }
    };
  }

  onTabActivated(index) {
    const tabName = this.tabs[index];
    if (tabName === 'calls' && this.callsView && typeof this.callsView.refresh === 'function') {
      this.callsView.refresh();
    } else if (tabName === 'chats' && this.homeView && typeof this.homeView.loadChatList === 'function') {
      this.homeView.loadChatList();
    }
  }

  switchToTab(tabName, smooth = true) {
    const index = this.tabs.indexOf(tabName);
    if (index === -1) return;
    this.scrollToIndex(index, smooth);
    this.onTabActivated(index);
  }

  scrollToIndex(index, smooth = true) {
    this.currentIndex = index;
    this.updateBottomNav(index);

    if (this.viewport) {
      const width = this.viewport.clientWidth;
      if (width > 0) {
        this.isScrollingProgrammatically = true;
        this.viewport.scrollTo({
          left: index * width,
          behavior: smooth ? 'smooth' : 'auto'
        });
        clearTimeout(this.programmaticScrollTimeout);
        this.programmaticScrollTimeout = setTimeout(() => {
          this.isScrollingProgrammatically = false;
        }, smooth ? 350 : 60);
      }
    }
  }

  updateBottomNav(index) {
    if (!this.bottomNav) return;
    const tabs = this.bottomNav.querySelectorAll('.nav-tab');
    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === index);
    });
  }

  cleanup() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.onMouseMove) {
      window.removeEventListener('mousemove', this.onMouseMove);
      this.onMouseMove = null;
    }
    if (this.onMouseUp) {
      window.removeEventListener('mouseup', this.onMouseUp);
      this.onMouseUp = null;
    }
    clearTimeout(this.scrollTimeout);
    clearTimeout(this.programmaticScrollTimeout);
    window.setPagerSwipeEnabled = null;

    if (this.homeView && typeof this.homeView.cleanup === 'function') {
      this.homeView.cleanup();
    }
    if (this.callsView && typeof this.callsView.cleanup === 'function') {
      this.callsView.cleanup();
    }
    if (this.settingsView && typeof this.settingsView.cleanup === 'function') {
      this.settingsView.cleanup();
    }
  }
}
