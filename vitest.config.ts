import { defineConfig } from 'vitest/config';

/**
 * A suite deste repositorio nao toca banco nenhum.
 *
 * O carregamento de `.env` que existia no monorepo servia as TEST_*_DATABASE_URL
 * dos testes de RLS — que ficaram no backend, junto do PostgreSQL que eles
 * exigem. Trazer o carregamento para ca so criaria um caminho pelo qual
 * credencial de banco entraria num repositorio que nao tem o que fazer com ela.
 *
 * DOIS AMBIENTES
 *   packages/shared/tests   Node puro (regras e formatacao, sem DOM)
 *   apps/* /tests           jsdom + Testing Library (fluxos de tela)
 */
export default defineConfig({
  // JSX automatico: os arquivos .tsx dos apps nao importam `React`.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['packages/shared/tests/**/*.test.ts', 'apps/*/tests/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['apps/**', 'jsdom']],
    setupFiles: ['./vitest.setup.ts'],
  },
});
