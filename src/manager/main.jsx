import 'neba/styles.css';
import './manager.css';

import { NebaProvider, ToastProvider, TooltipProvider } from 'neba';
import { ko, registerMessages } from 'neba/locales';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { locale } from '../i18n/runtime.js';

import { App } from './App.jsx';

// neba speaks English on its own.
registerMessages('ko', ko);
document.documentElement.lang = locale;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NebaProvider defaults={{ size: 'sm', locale }} defaultColorScheme="system" storageKey={false}>
      <TooltipProvider>
        <ToastProvider position="bottom-center" locale={locale}>
          <App />
        </ToastProvider>
      </TooltipProvider>
    </NebaProvider>
  </StrictMode>,
);
