import { replayWorkspaceActions, updateWorkspace } from '../domain/workspace.ts';
import type { WorkspaceAction } from '../domain/workspace.ts';
import { loadTasks, recoverStorage, saveTasks } from './taskStorage.ts';
import type { LoadedTasks, StoragePort } from './taskStorage.ts';

export type ExclusiveRunner = <T>(work: () => T) => Promise<T>;
export type RepositoryState = LoadedTasks & { isWorking: boolean; hasUnsavedChanges: boolean };

/** Tasks and projects share one canonical transaction and one unsaved intention journal. */
export class TaskRepository {
  private state: RepositoryState;
  private readonly getStorage: () => StoragePort | null;
  private readonly exclusively: ExclusiveRunner;
  private readonly listeners = new Set<() => void>();
  private pending: WorkspaceAction[] = [];
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
  apply(action: WorkspaceAction): Promise<void> {
    return this.schedule(async () => {
      const data = updateWorkspace(this.state, action);
      this.pending.push(action);
      this.publish({ ...data, status: this.state.status });
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
      loaded.status === 'saved'
        ? loaded
        : { tasks: this.state.tasks, projects: this.state.projects, status: loaded.status },
    );
  };
  private async flush(allowRecovery: boolean): Promise<boolean> {
    try {
      return await this.exclusively(() => {
        const storage = this.getStorage();
        const latest = loadTasks(storage);
        if (latest.status === 'saved') {
          let data;
          try {
            data = replayWorkspaceActions(latest, this.pending);
          } catch {
            this.publish({ ...this.state, status: 'conflict' });
            return false;
          }
          if (saveTasks(storage, data.tasks, data.projects)) {
            this.pending = [];
            this.publish({ ...data, status: 'saved' });
            return true;
          }
          this.publish({ ...data, status: 'unsaved' });
          return false;
        }
        if (
          allowRecovery &&
          latest.status === 'corrupt' &&
          recoverStorage(storage, this.state.tasks, this.state.projects)
        ) {
          this.pending = [];
          this.publish({ ...this.state, status: 'saved' });
          return true;
        }
        this.publish({ ...this.state, status: latest.status });
        return false;
      });
    } catch {
      this.publish({ ...this.state, status: 'unavailable' });
      return false;
    }
  }
}
