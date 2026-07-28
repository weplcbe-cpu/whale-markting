import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const routesSource = read('src/routes.js');
const routePattern = /\{\s*role:\s*'([^']+)'[\s\S]*?id:\s*'([^']+)'[\s\S]*?path:\s*'([^']+)'[\s\S]*?component:\s*\(\)\s*=>\s*import\('([^']+)'\)/g;
const routes = [...routesSource.matchAll(routePattern)].map(([, role, id, path, component]) => ({ role, id, path, component }));
const errors = [];
const paths = new Map();

for (const route of routes) {
  if (paths.has(route.path)) errors.push(`duplicate route: ${route.path} (${paths.get(route.path)} and ${route.id})`);
  paths.set(route.path, route.id);
  if (!existsSync(resolve(root, `src/${route.component.replace('./components/', 'components/')}.jsx`))) {
    errors.push(`missing route component: ${route.path} -> ${route.component}`);
  }
}

const routeMatches = (path) => [...paths.keys()].some((configured) => {
  const expression = `^${configured.replace(/:[^/]+/g, '[^/]+').replaceAll('/', '\\/')}$`;
  return new RegExp(expression).test(path);
});
const auditedFiles = [
  'src/App.jsx', 'src/components/common/Sidebar.jsx', 'src/components/common/MobileBottomNav.jsx', 'src/components/common/Navbar.jsx',
  'src/components/admin/AdminDashboard.jsx', 'src/components/director/DirectorDashboard.jsx', 'src/components/director/AnalyticsTabs.jsx',
  'src/components/marketing/MarketingDashboard.jsx', 'src/components/marketing/AddVisitPlan.jsx', 'src/components/director/WeeklyPlanReview.jsx',
];

for (const file of auditedFiles) {
  const source = read(file);
  const quotedPaths = [...source.matchAll(/['"](\/(?:admin|director|marketing)(?:\/[^'"?`}]*)?(?:\?[^'"]*)?)['"]/g)].map((match) => match[1].split('?')[0]);
  for (const path of quotedPaths) if (!routeMatches(path)) errors.push(`invalid navigation target in ${file}: ${path}`);
}

const sidebar = read('src/components/common/Sidebar.jsx');
for (const route of routes.filter((route) => route.role === 'Marketing Team' || route.role === 'Admin')) {
  if (!sidebar.includes(route.id)) errors.push(`sidebar route missing id: ${route.role} ${route.id}`);
}

const dashboard = read('src/components/admin/AdminDashboard.jsx');
const adminIds = new Set(routes.filter((route) => route.role === 'Admin').map((route) => route.id));
for (const [, id] of dashboard.matchAll(/setActiveTab\('([^']+)'\)/g)) {
  if (!adminIds.has(id)) errors.push(`Admin dashboard shortcut references unknown tab: ${id}`);
}

const navbar = read('src/components/common/Navbar.jsx');
for (const destination of [...navbar.matchAll(/return '(\/(?:admin|director|marketing)[^']*)'/g)].map((match) => match[1])) {
  if (!routeMatches(destination)) errors.push(`notification destination is not a route: ${destination}`);
}

if (!routes.length) errors.push('no configured routes were discovered');
if (errors.length) {
  console.error(`Navigation audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Navigation audit passed: ${routes.length} routes, ${auditedFiles.length} navigation sources, no duplicates or invalid static targets.`);
}
