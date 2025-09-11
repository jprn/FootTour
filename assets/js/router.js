// Simple hash-based router with param support like #/app/t/123/teams

const routes = [];

function pathToRegex(path) {
  const pattern = path
    .replace(/\//g, '\\/')
    .replace(/:\w+/g, '([^/]+)');
  return new RegExp(`^${pattern}$`);
}

function getParams(match) {
  const values = match.result.slice(1);
  const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(r => r[1]);
  return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
}

export function addRoute(path, render) {
  routes.push({ path, regex: pathToRegex(path), render });
}

export async function navigate(hash) {
  if (hash && location.hash !== hash) {
    location.hash = hash;
  }
  return handleRoute();
}

export async function handleRoute() {
  const full = location.hash.replace(/^#/, '') || '/';
  const pathOnly = full.split('?')[0];
  const potentialMatches = routes.map(route => ({
    route,
    result: pathOnly,
  })).map(m => ({
    ...m,
    result: m.result.match(routeToRegex(m.route.path)),
  }));

  function routeToRegex(path) { return pathToRegex(path); }

  let match = potentialMatches.find(m => m.result);

  if (!match) {
    // default to landing
    match = {
      route: routes.find(r => r.path === '/'),
      result: [location.hash]
    };
  }

  const params = match.result ? getParams({ result: match.result, route: match.route }) : {};
  const html = await match.route.render(params);
  const app = document.getElementById('app');
  app.innerHTML = html;

  // run optional onMount hooks added to window.__page_on_mount
  if (window.__page_on_mount) {
    await Promise.all(window.__page_on_mount.map(fn => fn?.()));
  }
  window.__page_on_mount = [];
}

window.addEventListener('hashchange', handleRoute);
