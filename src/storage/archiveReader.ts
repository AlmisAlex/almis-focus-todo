import { BlobReader } from '@zip.js/zip.js/index-native.js';

/** Bound metadata reads before zip.js allocates a central-directory buffer.
 * File bodies still stream in small chunks, independently of their total size. */
export class BoundedArchiveReader extends BlobReader {
  override async readUint8Array(index: number, length: number): Promise<Uint8Array> {
    if (!Number.isSafeInteger(length) || length < 0 || length > 16 * 1024 * 1024)
      throw new Error('Слишком большой каталог архива.');
    return super.readUint8Array(index, length);
  }
}
