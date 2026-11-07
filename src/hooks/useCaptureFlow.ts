import { useRef, useState } from 'react';

/** Keep quick text until its task exists. Cancelled details return to the same quick draft. */
export function useCaptureFlow() {
  const [title, setTitle] = useState('');
  const [initialTitle, setInitialTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const fromQuick = useRef(false);
  const open = () => {
    fromQuick.current = false;
    setInitialTitle('');
    setCreating(true);
  };
  const openDetails = () => {
    fromQuick.current = true;
    setInitialTitle(title);
    setCreating(true);
  };
  const close = () => {
    fromQuick.current = false;
    setCreating(false);
    setInitialTitle('');
  };
  const consume = () => {
    if (fromQuick.current) setTitle('');
    fromQuick.current = false;
  };
  return { title, setTitle, initialTitle, creating, open, openDetails, close, consume };
}
