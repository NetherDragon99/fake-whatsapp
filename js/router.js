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
      this.currentViewInstance.cleanup();
    }

    const ViewClass = matchedRoute.viewClass;
    this.currentViewInstance = new ViewClass(this);
    await this.currentViewInstance.render(this.rootContainer, routeParams);
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
