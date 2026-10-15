// Keeps photo bytes in Postgres. It is the default because it works
// identically on a long-lived server and on a read-only serverless filesystem,
// and because it makes a database backup a complete backup.

import { withTransaction } from '../db.js';
import { Display, ErrNotFound, MediaError, Thumb, newKey, process } from './index.js';

export class PGStore {
  #pool;

  constructor(pool) {
    this.#pool = pool;
  }

  async save(input) {
    const out = await process(input);
    const key = newKey();

    await withTransaction(this.#pool, async (tx) => {
      for (const [variant, rendition] of [[Display, out.display], [Thumb, out.thumb]]) {
        try {
          await tx.query(
            `INSERT INTO photos (key, variant, bytes, byte_size, width, height)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [key, variant, rendition.bytes, rendition.bytes.length, rendition.width, rendition.height]
          );
        } catch (err) {
          throw new Error(`store ${variant}: ${err.message}`, { cause: err });
        }
      }
    });

    return key;
  }

  async open(key, variant) {
    const { rows } = await this.#pool.query(
      `SELECT bytes FROM photos WHERE key = $1 AND variant = $2`, [key, variant]);
    if (rows.length === 0) throw new MediaError(ErrNotFound, key);
    return rows[0].bytes;
  }

  async delete(key) {
    if (key === '') return;
    await this.#pool.query(`DELETE FROM photos WHERE key = $1`, [key]);
  }
}