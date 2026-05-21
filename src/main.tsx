import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ensureAuthHydrated } from './lib/auth.ts';
import { applyFreshAtsReset } from './lib/freshStart.ts';

async function bootstrap() {
  applyFreshAtsReset();
  await ensureAuthHydrated();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
