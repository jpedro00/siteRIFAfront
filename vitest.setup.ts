import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Desmonta a arvore entre testes: sem isso, o DOM de um teste vaza para o seguinte.
afterEach(() => {
  cleanup();
});
