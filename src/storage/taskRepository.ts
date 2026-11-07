import { replayTaskActions, updateTasks } from '../domain/tasks.ts';
import type { TaskAction } from '../domain/tasks.ts';
import { loadTasks, recoverStorage, saveTasks } from './taskStorage.ts';
import type { LoadedTasks, StoragePort } from './taskStorage.ts';

export type ExclusiveRunner = <T>(work: () => T) => Promise<T>;
export type RepositoryState = LoadedTasks & { isWorking: boolean; hasUnsavedChanges: boolean };

/** Storage transactions and an intention journal, independent of React rendering. */
export class TaskRepository {
  private state: RepositoryState;
  private readonly getStorage: () => StoragePort | null;
  private readonly exclusively: ExclusiveRunner;
  private readonly listeners = new Set<() => void>();
  private pending: TaskAction[] = [];
  private queue: Promise<void> = Promise.resolve();
  private scheduled = 0;

  constructor(getStorage: () => StoragePort | null, exclusively: ExclusiveRunner) {
    this.getStorage = getStorage;
    this.exclusively = exclusively;
    this.state = { ...loadTasks(getStorage()), isWorking: false, hasUnsavedChanges: false };
  }

  getSnapshot = (): RepositoryState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: LoadedTasks) {
    this.state = {
      ...next,
      isWorking: this.scheduled > 0,
      hasUnsavedChanges: this.pending.length > 0,
    };
    for (const listener of this.listeners) listener();
  }

  private schedule<T>(work: () => Promise<T>): Promise<T> {
    this.scheduled += 1;
    this.publish(this.state);
    const result = this.queue.then(work);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this.scheduled -= 1;
      if (!this.scheduled && !this.pending.length) this.syncExternal();
      else this.publish(this.state);
    });
  }

  apply(action: TaskAction): Promise<void> {
    return this.schedule(async () => {
      const tasks = updateTasks(this.state.tasks, action);
      this.pending.push(action);
      this.publish({ tasks, status: this.state.status });
      await this.flush(false);
    });
  }

  retrySave(): Promise<boolean> {
    return this.schedule(() => this.flush(true));
  }

  syncExternal = () => {
    if (this.pending.length || this.scheduled) return;
    const loaded = loadTasks(this.getStorage());
    this.publish(
      loaded.status === 'saved' ? loaded : { tasks: this.state.tasks, status: loaded.status },
    );
  };

  private async flush(allowRecovery: boolean): Promise<boolean> {
    try {
      return await this.exclusively(() => {
        const storage = this.getStorage();
        const latest = loadTasks(storage);
        if (latest.status === 'saved') {
          let tasks;
          try {
            tasks = replayTaskActions(latest.tasks, this.pending);
          } catch {
            this.publish({ tasks: this.state.tasks, status: 'conflict' });
            return false;
          }
          if (saveTasks(storage, tasks)) {
            this.pending = [];
            this.publish({ tasks, status: 'saved' });
            return true;
          }
          this.publish({ tasks, status: 'unsaved' });
          return false;
        }
        if (
          allowRecovery &&
          latest.status === 'corrupt' &&
          recoverStorage(storage, this.state.tasks)
        ) {
          this.pending = [];
          this.publish({ tasks: this.state.tasks, status: 'saved' });
          return true;
        }
        this.publish({ tasks: this.state.tasks, status: latest.status });
        return false;
      });
    } catch {
      // No Web Locks or denied storage: keep work in memory, never do unsafe writes.
      this.publish({ tasks: this.state.tasks, status: 'unavailable' });
      return false;
    }
  }
}
