import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // No task titles, storage payloads or browser data are sent to third parties.
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-state">
          <span className="eyebrow">FOCUS</span>
          <h1>Нужна короткая пауза.</h1>
          <p>
            Не удалось отобразить список. Обновите страницу — сохранённые задачи останутся в
            браузере.
          </p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Обновить страницу
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
