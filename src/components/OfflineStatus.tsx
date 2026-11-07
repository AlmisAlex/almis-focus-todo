import { useEffect, useRef, useState } from 'react';

type InstallRequest = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** Only the app shell is cached. User tasks and files never enter the static cache. */
export function OfflineStatus({ blocked }: { blocked: boolean }) {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [install, setInstall] = useState<InstallRequest | null>(null);
  const [error, setError] = useState('');
  const applying = useRef(false);
  useEffect(() => {
    let live = true;
    let hadController = !!navigator.serviceWorker?.controller;
    const connection = () => setOffline(!navigator.onLine);
    const installed = () => setInstall(null);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallRequest);
    };
    const changed = () => {
      if (applying.current) window.location.reload();
      else if (hadController) setWaiting(navigator.serviceWorker.controller);
      hadController = true;
      setReady(true);
    };
    const refresh = (registration: ServiceWorkerRegistration) => {
      if (!live) return;
      setReady(!!registration.active);
      setWaiting(
        (current) => registration.waiting ?? (current?.state === 'activated' ? current : null),
      );
    };
    let worker: ServiceWorker | null = null;
    let registration: ServiceWorkerRegistration | null = null;
    const stateChanged = () => {
      if (registration) refresh(registration);
    };
    const found = () => {
      worker?.removeEventListener('statechange', stateChanged);
      worker = registration?.installing ?? null;
      worker?.addEventListener('statechange', stateChanged);
    };
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installed);
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      void navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((value) => {
          if (!live) return;
          registration = value;
          refresh(value);
          found();
          value.addEventListener('updatefound', found);
        })
        .catch(() => {
          if (live) setError('Офлайн-копия пока недоступна. Задачи сохраняются локально.');
        });
      void navigator.serviceWorker.ready.then(() => {
        if (live) setReady(true);
      });
    }
    return () => {
      live = false;
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', prompt);
      window.removeEventListener('appinstalled', installed);
      navigator.serviceWorker?.removeEventListener('controllerchange', changed);
      registration?.removeEventListener('updatefound', found);
      worker?.removeEventListener('statechange', stateChanged);
    };
  }, []);
  return (
    <div className="offline-status">
      <span role="status">
        {offline
          ? 'Без сети · задачи и файлы доступны локально'
          : ready
            ? 'Офлайн-версия готова'
            : 'Локальное пространство'}
      </span>
      {install && (
        <button
          type="button"
          className="text-button"
          onClick={async () => {
            try {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            } catch {
              setError('Установку можно повторить через меню браузера.');
            }
          }}
        >
          Установить приложение
        </button>
      )}
      {waiting && (
        <button
          type="button"
          className="text-button"
          disabled={blocked}
          onClick={() => {
            const draft = document.querySelector<HTMLInputElement>('#quick-capture')?.value.trim();
            if (blocked || draft || document.querySelector('dialog[open], .import-preview')) {
              setError('Завершите ввод и сохраните открытые окна перед обновлением.');
              return;
            }
            applying.current = true;
            if (waiting.state === 'activated') {
              window.location.reload();
              return;
            }
            waiting.postMessage({ type: 'ACTIVATE_FOCUS_UPDATE' });
          }}
        >
          Обновление готово · применить
        </button>
      )}
      {error && (
        <p className="input-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
