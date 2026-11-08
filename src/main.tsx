import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './styles.css';
import './workspace.css';
import './files.css';
import './command.css';
import './motion.css';
import './ledger.css';
import './task-controls.css';
import './planner.css';
import './board.css';
import './preferences.css';
import './navigation.css';
import './focus.css';
import './dialog-layout.css';
import './task-workspace.css';
import './overview.css';
import './file-viewers.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
