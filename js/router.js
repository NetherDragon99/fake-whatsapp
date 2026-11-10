// Hash-based Client-Side Router for WhatsApp Android Clone
export class Router {
  constructor(routes, rootContainer) {
    this.routes = routes;
    this.rootContainer = rootContainer;
    this.currentViewInstance = null;

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  init() {
    if (!window.location.hash) {
      window.location.hash = '#/chats';
    } else {
      this.handleRoute();
    }
  }

  navigate(hash) {
    if (window.location.hash === hash) {
      this.handleRoute();
    } else {
      window.location.hash = hash;
    }
  }

  async handleRoute() {
    const fullHash = window.location.hash.slice(1) || '/chats';
    const [pathPart, queryPart] = fullHash.split('?');

    // Parse query params
    const queryParams = {};
    if (queryPart) {
      const sp = new URLSearchParams(queryPart);
      for (const [k, v] of sp.entries()) {
        queryParams[k] = v;
      }
    }

    // Match route
    let matchedRoute = null;
    let routeParams = {};

    for (const route of this.routes) {
      const match = this.matchPattern(route.pattern, pathPart);
      if (match) {
        matchedRoute = route;
        routeParams = { ...(route.defaultParams || {}), ...match, ...queryParams };
        break;
      }
    }

    if (!matchedRoute) {
      // Fallback to chats
      this.navigate('#/chats');
      return;
    }

    // Cleanup previous view if needed
    if (this.currentViewInstance && typeof this.currentViewInstance.cleanup === 'function') {
      try {
        this.currentViewInstance.cleanup();
      } catch (err) {
        console.warn('[Router] Error cleaning up previous view:', err);
      }
    }

    try {
      const ViewClass = matchedRoute.viewClass;
      this.currentViewInstance = new ViewClass(this);
      await this.currentViewInstance.render(this.rootContainer, routeParams);
    } catch (renderErr) {
      console.error('[Router] Error rendering view:', renderErr);
      this.rootContainer.innerHTML = `
        <div class="empty-state" style="padding: 40px 16px; text-align: center;">
          <h3 style="color: var(--wa-text-primary); margin-bottom: 8px;">Failed to load page</h3>
          <p style="color: var(--wa-text-secondary); margin-bottom: 20px;">${renderErr.message || 'An error occurred while opening this page.'}</p>
          <button type="button" class="btn-chat-primary" onclick="window.location.hash='#/chats'" style="padding: 10px 24px; border-radius: 20px; border: none; background: var(--app-accent, #25d366); color: #0b141a; font-weight: 600; cursor: pointer;">
            Return to Chats
          </button>
        </div>
      `;
    }
  }

  matchPattern(pattern, path) {
    const patternSegments = pattern.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);

    if (patternSegments.length !== pathSegments.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < patternSegments.length; i++) {
      const pSeg = patternSegments[i];
      const actualSeg = pathSegments[i];

      if (pSeg.startsWith(':')) {
        const paramName = pSeg.slice(1);
        params[paramName] = decodeURIComponent(actualSeg);
      } else if (pSeg !== actualSeg) {
        return null;
      }
    }

    return params;
  }
}
