import { useRef, useState } from 'react';
import type { useTasks } from './useTasks.ts';
import type { AttachmentModel } from './useAttachments.ts';
import { exampleFiles } from '../domain/demoFiles.ts';

type FileJob = { taskId: string; files: File[] };

/** Explicit sample creation only. File retries skip attachments already saved. */
export function useDemoWorkspace({
  model,
  attachments,
  today,
  onLoaded,
  onError,
}: {
  model: ReturnType<typeof useTasks>;
  attachments: AttachmentModel;
  today: string;
  onLoaded: () => void;
  onError: (error: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const working = useRef(false);
  const create = async () => {
    if (model.tasks.length || model.isWorking || working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const files = await exampleFiles();
      const tasks = await model.addExamples(today);
      const incoming = [
        { taskId: tasks[0]!.id, files: files.plan },
        { taskId: tasks[2]!.id, files: files.personal },
        { taskId: tasks[3]!.id, files: files.idea },
      ];
      setJobs(incoming);
      for (const job of incoming) await attachments.add(job.taskId, job.files);
      setJobs([]);
      onLoaded();
    } catch (error) {
      onError(error);
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const retry = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      for (const job of jobs) {
        if (!model.tasks.some((task) => task.id === job.taskId)) continue;
        const missing = job.files.filter(
          (file) =>
            !attachments.files.some(
              (saved) => saved.taskId === job.taskId && saved.name === file.name,
            ),
        );
        if (missing.length) await attachments.add(job.taskId, missing);
      }
      setJobs([]);
      onLoaded();
    } catch (error) {
      onError(error);
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return { busy, pendingFiles: jobs.length > 0, create, retry };
}
