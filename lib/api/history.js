// Item location history.

import { queryInt, urlID, writeJSON, writeStoreErr } from '../http.js';
import { getItem, itemHistory, recentMoves } from '../store/item.js';

export function registerHistory(router, s) {
  /** Answers "where has this been?", newest move first. */
  router.get('/api/items/{itemID}/history', async (req, res) => {
    const id = urlID(req, res, 'itemID');
    if (!id) return;
    try {
      await getItem(s.store, id); // 404 when the item is gone
      writeJSON(res, 200, { moves: await itemHistory(s.store, id) });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });

  /** The home screen's "last put away" feed. */
  router.get('/api/activity', async (req, res) => {
    try {
      writeJSON(res, 200, {
        moves: await recentMoves(s.store, queryInt(req, 'limit', 10)),
      });
    } catch (err) {
      writeStoreErr(res, err);
    }
  });
}
