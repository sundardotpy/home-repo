package api

import (
	"net/http"
)

// itemHistory answers "where has this been?", newest move first.
func (s *Server) itemHistory(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "itemID")
	if !ok {
		return
	}
	if _, err := s.store.GetItem(r.Context(), id); err != nil {
		writeStoreErr(w, err)
		return
	}
	moves, err := s.store.ItemHistory(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"moves": moves})
}

// recentActivity is the home screen's "last put away" feed.
func (s *Server) recentActivity(w http.ResponseWriter, r *http.Request) {
	moves, err := s.store.RecentMoves(r.Context(), queryInt(r, "limit", 10))
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"moves": moves})
}
