// Tags and custom-property autocomplete.

import { decode, noContent, writeErr, writeJSON, writeStoreErr } from '../http.js';
import { normaliseTag } from '../store/tag.js';
import {
  createTag, deleteTag, listPropertyKeys, listTags, renameTag,
} from '../store/tag.js';

const TAG_SCHEMA = { name: 'str' };

export function registerTags(router, s) {
  router.get('/api/tags', async (req, res) => {
    try {
      writeJSON(res, 200, { tags: await listTags(s.store) });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  router.post('/api/tags', async (req, res) => {
    const b = await decode(req, res, TAG_SCHEMA);
    if (b === null) return;
    if (b.name === undefined || b.name === null || normaliseTag(b.name) === '') {
      writeErr(res, 400, 'name is required');
      return;
    }
    try {
      writeJSON(res, 201, await createTag(s.store, b.name));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  /** Rewrites the tag on every item that carries it. */
  router.patch('/api/tags/{tag}', async (req, res) => {
    const b = await decode(req, res, TAG_SCHEMA);
    if (b === null) return;
    if (b.name === undefined || b.name === null || normaliseTag(b.name) === '') {
      writeErr(res, 400, 'name is required');
      return;
    }
    try {
      writeJSON(res, 200, await renameTag(s.store, req.params.tag, b.name));
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  /** Retires a tag and strips it from every item that used it. */
  router.delete('/api/tags/{tag}', async (req, res) => {
    try {
      await deleteTag(s.store, req.params.tag);
      noContent(res);
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  /**
   * Powers autocomplete for custom fields: which keys exist, how often, and
   * which values they have been given.
   */
  router.get('/api/properties', async (req, res) => {
    try {
      writeJSON(res, 200, { properties: await listPropertyKeys(s.store) });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });
}
