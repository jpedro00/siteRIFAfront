/**
 * Site unico: Storefront, Organizer e Admin num SO projeto da Vercel, sob o mesmo dominio.
 *
 *   /         Storefront (site publico, marketplace, conta)
 *   /painel/  Organizer (painel do criador)
 *   /admin/   Admin (console da plataforma)
 *
 * Cada app e compilado com o seu caminho publico (VITE_BASE_PATH) e o resultado dos dois
 * paineis e copiado para dentro da pasta do Storefront (apps/storefront/dist), que e o
 * `outputDirectory` do projeto. Mesmo dominio = um unico cookie de sessao para os tres.
 *
 * O build separado de cada app (um projeto por app) continua funcionando: sem VITE_BASE_PATH
 * o caminho publico e "/".
 *
 * Uso: node scripts/build-site.mjs   (a Vercel chama pelo buildCommand de apps/storefront)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function compilar(workspace, basePath) {
  const r = spawnSync(npm, ['run', 'build', '-w', workspace], {
    cwd: raiz,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, VITE_BASE_PATH: basePath },
  });
  if (r.status !== 0) {
    console.error(`\nFalha ao compilar ${workspace}.`);
    process.exit(r.status ?? 1);
  }
}

// O Storefront primeiro: o build dele esvazia a propria pasta `dist`.
compilar('@clubedarifa/storefront', '/');
compilar('@clubedarifa/organizer', '/painel/');
compilar('@clubedarifa/admin', '/admin/');

const saida = join(raiz, 'apps', 'storefront', 'dist');
for (const [app, destino] of [
  ['organizer', 'painel'],
  ['admin', 'admin'],
]) {
  const alvo = join(saida, destino);
  rmSync(alvo, { recursive: true, force: true });
  cpSync(join(raiz, 'apps', app, 'dist'), alvo, { recursive: true });
}

// Conferencia: cada index.html aponta para os arquivos dentro do PROPRIO prefixo. Um painel
// com caminho "/assets/..." pegaria os arquivos do site publico e abriria em branco.
const esperado = [
  ['index.html', '/'],
  ['painel/index.html', '/painel/'],
  ['admin/index.html', '/admin/'],
];
let ok = true;
for (const [arquivo, prefixo] of esperado) {
  const caminho = join(saida, arquivo);
  if (!existsSync(caminho)) {
    console.error(`FALTA ${arquivo}`);
    ok = false;
    continue;
  }
  const html = readFileSync(caminho, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*assets\/[^"]+)"/g)].map((m) => m[1]);
  if (refs.length === 0 || refs.some((r) => !r.startsWith(`${prefixo}assets/`))) {
    console.error(`${arquivo}: os arquivos nao estao sob ${prefixo}assets/ -> ${refs.join(', ') || '(nenhum)'}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('\nSite unico montado em apps/storefront/dist: /, /painel/ e /admin/.');
