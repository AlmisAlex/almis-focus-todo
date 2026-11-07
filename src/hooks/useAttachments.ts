import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment } from '../domain/attachments.ts';
import { TaskInputError } from '../domain/tasks.ts';
import {
  addAttachments,
  importAttachments,
  listAttachments,
  removeAttachment,
  fileStorageMessage,
} from '../storage/attachmentStorage.ts';

export function useAttachments() {
  const [files, setFiles] = useState<readonly Attachment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const working = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const records = await listAttachments();
      if (request === generation.current) {
        setFiles(records);
        setError('');
      }
    } catch (caught) {
      if (request === generation.current) setError(fileStorageMessage(caught));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    if (typeof BroadcastChannel !== 'undefined') {
      const broadcast = new BroadcastChannel('almis.focus.files.changed');
      channel.current = broadcast;
      broadcast.onmessage = onFocus;
    }
    return () => {
      window.removeEventListener('focus', onFocus);
      channel.current?.close();
      channel.current = null;
    };
  }, [refresh]);
  const change = async (operation: () => Promise<void>) => {
    if (working.current) throw new TaskInputError('Дождись завершения текущей операции с файлами.');
    working.current = true;
    setBusy(true);
    try {
      await operation();
      await refresh();
      channel.current?.postMessage('changed');
    } catch (caught) {
      throw new TaskInputError(fileStorageMessage(caught));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return {
    files,
    error,
    loading,
    busy,
    refresh,
    add: (taskId: string, incoming: readonly File[]) =>
      change(() => addAttachments(taskId, incoming)),
    remove: (id: string) => change(() => removeAttachment(id)),
    import: (incoming: readonly Attachment[]) => change(() => importAttachments(incoming)),
  };
}
export type AttachmentModel = ReturnType<typeof useAttachments>;
