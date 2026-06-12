import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles.css';

type ColorTheme = 'dark' | 'light';

function setTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
}

function fallbackTheme(): ColorTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

setTheme(fallbackTheme());

if (window.waybetterCalendar?.theme) {
  void window.waybetterCalendar.theme.get().then(setTheme).catch(() => setTheme(fallbackTheme()));
  window.waybetterCalendar.theme.onChange(setTheme);
} else {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    setTheme(event.matches ? 'dark' : 'light');
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
