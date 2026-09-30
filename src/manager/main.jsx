import 'neba/styles.css';
import './manager.css';

import { NebaProvider, ToastProvider, TooltipProvider } from 'neba';
import { ko, registerMessages } from 'neba/locales';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.jsx';

registerMessages('ko', ko);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NebaProvider defaults={{ size: 'sm', locale: 'ko' }} defaultColorScheme="system" storageKey={false}>
      <TooltipProvider>
        <ToastProvider position="bottom-center" locale="ko">
          <App />
        </ToastProvider>
      </TooltipProvider>
    </NebaProvider>
  </StrictMode>,
);
