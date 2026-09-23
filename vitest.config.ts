import { defineConfig } from 'vitest/config';

/**
 * A suite deste repositorio nao toca banco nenhum.
 *
 * O carregamento de `.env` que existia no monorepo servia as TEST_*_DATABASE_URL
 * dos testes de RLS — que ficaram no backend, junto do PostgreSQL que eles
 * exigem. Trazer o carregamento para ca so criaria um caminho pelo qual
 * credencial de banco entraria num repositorio que nao tem o que fazer com ela.
 *
 * Por isso tambem nao ha `fileParallelism: false`: sem recurso compartilhado,
 * nao ha o que serializar.
 */
export default defineConfig({
  test: {
    include: ['packages/shared/tests/**/*.test.ts'],
  },
});
