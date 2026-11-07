const MAX_CHARACTERS = 200_000;
const MAX_ITEMS = 5_000;

/** Consume incremental text without building a full-page intermediate string. */
export async function readBoundedText<T extends { items: readonly unknown[] }>(
  stream: ReadableStream<T>,
  limits = { characters: MAX_CHARACTERS, items: MAX_ITEMS },
  signal?: AbortSignal,
) {
  if (
    !Number.isInteger(limits.characters) ||
    limits.characters < 1 ||
    limits.characters > MAX_CHARACTERS ||
    !Number.isInteger(limits.items) ||
    limits.items < 1 ||
    limits.items > MAX_ITEMS
  )
    throw Error('Invalid text budget');
  const reader = stream.getReader();
  const parts: string[] = [];
  let length = 0,
    items = 0,
    truncated = false;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    reading: while (true) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const chunk = await reader.read();
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (chunk.done) break;
      for (const item of chunk.value.items) {
        if (++items > limits.items) {
          truncated = true;
          break reading;
        }
        if (
          !item ||
          typeof item !== 'object' ||
          !('str' in item) ||
          typeof item.str !== 'string' ||
          !item.str
        )
          continue;
        const separator = parts.length ? 1 : 0;
        const remaining = limits.characters - length - separator;
        if (remaining <= 0) {
          truncated = true;
          break reading;
        }
        const text = item.str.slice(0, remaining);
        parts.push(text);
        length += text.length + separator;
        if (text.length < item.str.length || length >= limits.characters) {
          truncated = true;
          break reading;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
  return { value: parts.join(' '), truncated };
}
