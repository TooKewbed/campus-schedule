import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import { registerServiceWorker } from './lib/pwa';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

// After the first render, so the worker never delays what people actually see.
registerServiceWorker();
