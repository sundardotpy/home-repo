package store

import (
	"context"
	"strings"

	"github.com/sundar/home_sweet_home/internal/model"
)

// NormaliseTag is the single definition of what a tag looks like: trimmed,
// lowercased, inner whitespace collapsed. Both the catalogue and items go
// through it, so "Spare Parts" and " spare  parts " are the same tag.
func NormaliseTag(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}

// ListTags returns the whole vocabulary with usage counts, unused tags
// included — a tag you have created but not applied yet is still a tag.
func (s *Store) ListTags(ctx context.Context) ([]*model.Tag, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t.name, count(i.id)
		  FROM tags t
		  LEFT JOIN items i ON t.name = ANY(i.tags)
		 GROUP BY t.name
		 ORDER BY count(i.id) DESC, t.name`)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := []*model.Tag{}
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.Name, &t.Count); err != nil {
			return nil, mapErr(err)
		}
		out = append(out, &t)
	}
	return out, mapErr(rows.Err())
}

// EnsureTags adds anything new to the catalogue. Called on every item write, so
// a tag typed into the item form joins the vocabulary without ceremony.
func (s *Store) EnsureTags(ctx context.Context, names []string) error {
	if len(names) == 0 {
		return nil
	}
	clean := make([]string, 0, len(names))
	for _, n := range names {
		if n = NormaliseTag(n); n != "" {
			clean = append(clean, n)
		}
	}
	if len(clean) == 0 {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO tags (name) SELECT unnest($1::text[])
		ON CONFLICT (name) DO NOTHING`, clean)
	return mapErr(err)
}

func (s *Store) CreateTag(ctx context.Context, name string) (*model.Tag, error) {
	name = NormaliseTag(name)
	if name == "" {
		return nil, ErrInvalid
	}
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, name); err != nil {
		return nil, mapErr(err)
	}
	return &model.Tag{Name: name}, nil
}

// RenameTag updates the catalogue and rewrites the tag on every item that
// carries it, in one transaction — a rename that left items behind would be
// worse than no rename at all.
func (s *Store) RenameTag(ctx context.Context, from, to string) (*model.Tag, error) {
	from, to = NormaliseTag(from), NormaliseTag(to)
	if from == "" || to == "" {
		return nil, ErrInvalid
	}
	if from == to {
		return &model.Tag{Name: to}, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, mapErr(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	tag, err := tx.Exec(ctx, `DELETE FROM tags WHERE name = $1`, from)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, to); err != nil {
		return nil, mapErr(err)
	}
	// array_remove then append, rather than array_replace, so an item that
	// already had the destination tag does not end up with it twice.
	if _, err := tx.Exec(ctx, `
		UPDATE items
		   SET tags = (
		       SELECT array_agg(DISTINCT tg ORDER BY tg)
		         FROM unnest(array_append(array_remove(tags, $1), $2)) tg
		   ),
		       updated_at = now()
		 WHERE $1 = ANY(tags)`, from, to); err != nil {
		return nil, mapErr(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, mapErr(err)
	}
	return &model.Tag{Name: to}, nil
}

// DeleteTag retires a tag and strips it from every item.
func (s *Store) DeleteTag(ctx context.Context, name string) error {
	name = NormaliseTag(name)
	if name == "" {
		return ErrInvalid
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return mapErr(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	tag, err := tx.Exec(ctx, `DELETE FROM tags WHERE name = $1`, name)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err := tx.Exec(ctx,
		`UPDATE items SET tags = array_remove(tags, $1), updated_at = now()
		  WHERE $1 = ANY(tags)`, name); err != nil {
		return mapErr(err)
	}
	return mapErr(tx.Commit(ctx))
}

// ListPropertyKeys reports every custom field in use, with the values it has
// been given, so both halves of the form can autocomplete.
func (s *Store) ListPropertyKeys(ctx context.Context) ([]*model.PropertyKey, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT pr.key, count(*) AS uses,
		       (array_agg(DISTINCT pr.value))[1:20] AS values
		  FROM items i, jsonb_each_text(i.properties) pr
		 GROUP BY pr.key
		 ORDER BY uses DESC, pr.key`)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := []*model.PropertyKey{}
	for rows.Next() {
		var p model.PropertyKey
		if err := rows.Scan(&p.Key, &p.Count, &p.Values); err != nil {
			return nil, mapErr(err)
		}
		out = append(out, &p)
	}
	return out, mapErr(rows.Err())
}
