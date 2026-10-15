// The tag vocabulary.

import { invalid, notFound } from '../errors.js';
import { withTransaction } from '../db.js';
import { mapErr } from './sql.js';

/**
 * The single definition of what a tag looks like: trimmed, lowercased, inner
 * whitespace collapsed. Both the catalogue and items go through it, so
 * "Spare Parts" and " spare  parts " are the same tag.
 */
export function normaliseTag(s) {
  return String(s ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ');
}

/**
 * The whole vocabulary with usage counts, unused tags included — a tag you have
 * created but not applied yet is still a tag.
 */
export async function listTags(store) {
  const { rows } = await store.pool.query(`
    SELECT t.name, count(i.id)
      FROM tags t
      LEFT JOIN items i ON t.name = ANY(i.tags)
     GROUP BY t.name
     ORDER BY count(i.id) DESC, t.name`);
  return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
}

/**
 * Adds anything new to the catalogue. Called on every item write, so a tag typed
 * into the item form joins the vocabulary without ceremony.
 */
export async function ensureTags(store, names) {
  if (!names || names.length === 0) return;

  const clean = names.map(normaliseTag).filter((n) => n !== '');
  if (clean.length === 0) return;

  try {
    await store.pool.query(
      `INSERT INTO tags (name) SELECT unnest($1::text[]) ON CONFLICT (name) DO NOTHING`,
      [clean]
    );
  } catch (err) {
    throw mapErr(err);
  }
}

export async function createTag(store, name) {
  const clean = normaliseTag(name);
  if (clean === '') throw invalid('empty tag');

  try {
    await store.pool.query(
      `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [clean]
    );
  } catch (err) {
    throw mapErr(err);
  }
  return { name: clean };
}

/**
 * Updates the catalogue and rewrites the tag on every item that carries it, in
 * one transaction — a rename that left items behind would be worse than no
 * rename at all.
 */
export async function renameTag(store, from, to) {
  const src = normaliseTag(from);
  const dst = normaliseTag(to);
  if (src === '' || dst === '') throw invalid('empty tag');
  if (src === dst) return { name: dst };

  return withTransaction(store.pool, async (tx) => {
    const del = await tx.query(`DELETE FROM tags WHERE name = $1`, [src]);
    if (del.rowCount === 0) throw notFound(`tag "${src}"`);

    await tx.query(
      `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [dst]);

    // array_remove then append, rather than array_replace, so an item that
    // already had the destination tag does not end up with it twice.
    await tx.query(`
      UPDATE items
         SET tags = (
             SELECT array_agg(DISTINCT tg ORDER BY tg)
               FROM unnest(array_append(array_remove(tags, $1), $2)) tg
           ),
           updated_at = now()
       WHERE $1 = ANY(tags)`, [src, dst]);

    return { name: dst };
  });
}

/** Retires a tag and strips it from every item. */
export async function deleteTag(store, name) {
  const clean = normaliseTag(name);
  if (clean === '') throw invalid('empty tag');

  return withTransaction(store.pool, async (tx) => {
    const del = await tx.query(`DELETE FROM tags WHERE name = $1`, [clean]);
    if (del.rowCount === 0) throw notFound(`tag "${clean}"`);

    await tx.query(`
      UPDATE items SET tags = array_remove(tags, $1), updated_at = now()
        WHERE $1 = ANY(tags)`, [clean]);
  });
}

/**
 * Every custom field in use, with the values it has been given, so both halves
 * of the form can autocomplete.
 */
export async function listPropertyKeys(store) {
  const { rows } = await store.pool.query(`
    SELECT pr.key, count(*) AS uses,
           (array_agg(DISTINCT pr.value))[1:20] AS values
      FROM items i, jsonb_each_text(i.properties) pr
     GROUP BY pr.key
     ORDER BY uses DESC, pr.key`);
  return rows.map((r) => ({
    key: r.key,
    count: Number(r.uses),
    values: r.values ?? [],
  }));
}
