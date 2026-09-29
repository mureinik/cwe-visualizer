import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  // The app writes the selected CWE into the URL (?cwe=), and jsdom keeps
  // the URL across tests, so reset it or the next test starts with a CWE
  // already selected. Tests in the node environment have no window.
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/');
  }
});
