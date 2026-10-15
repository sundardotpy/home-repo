// Writes photos to a directory. Kept for deployments that have a real volume
// and would rather not put image bytes in Postgres; selected with
// MEDIA_BACKEND=disk. Not usable on a read-only or ephemeral filesystem.

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Display, ErrNotFound, MediaError, Thumb, newKey, process } from './index.js';

export class DiskStore {
  #dir;

  constructor(dir) {
    this.#dir = dir;
  }

  async init() {
    await mkdir(this.#dir, { recursive: true, mode: 0o755 });
    return this;
  }

  get dir() {
    return this.#dir;
  }

  #suffix(variant) {
    return variant === Thumb ? '_t.jpg' : '.jpg';
  }

  async save(input) {
    const out = await process(input);
    const key = newKey();

    await mkdir(join(this.#dir, dirname(key)), { recursive: true, mode: 0o755 });
    await this.#write(`${key}.jpg`, out.display.bytes);
    try {
      await this.#write(`${key}_t.jpg`, out.thumb.bytes);
    } catch (err) {
      await rm(join(this.#dir, `${key}.jpg`), { force: true });
      throw err;
    }
    return key;
  }

  /**
   * Goes via a temp file so a crash mid-write cannot leave a truncated image
   * being served.
   */
  async #write(name, data) {
    const final = join(this.#dir, name);
    const tmp = `${final}.${process.pid}.tmp`;
    try {
      await writeFile(tmp, data);
      await rename(tmp, final);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  async open(key, variant) {
    try {
      return await readFile(join(this.#dir, key + this.#suffix(variant)));
    } catch (err) {
      if (err.code === 'ENOENT') throw new MediaError(ErrNotFound, key);
      throw err;
    }
  }

  async delete(key) {
    if (key === '') return;
    let firstErr = null;
    for (const variant of [Display, Thumb]) {
      try {
        await rm(join(this.#dir, key + this.#suffix(variant)), { force: true });
      } catch (err) {
        if (!firstErr) firstErr = err;
      }
    }
    if (firstErr) throw firstErr;
  }
}