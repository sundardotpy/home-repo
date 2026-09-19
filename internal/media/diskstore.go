package media

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// DiskStore writes photos to a directory. Kept for deployments that have a real
// volume and would rather not put image bytes in Postgres; selected with
// MEDIA_BACKEND=disk. Not usable on a read-only or ephemeral filesystem.
type DiskStore struct {
	dir string
}

func NewDiskStore(dir string) (*DiskStore, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create upload dir: %w", err)
	}
	return &DiskStore{dir: dir}, nil
}

func (s *DiskStore) Dir() string { return s.dir }

func (s *DiskStore) suffix(variant string) string {
	if variant == Thumb {
		return "_t.jpg"
	}
	return ".jpg"
}

func (s *DiskStore) Save(_ context.Context, r io.Reader) (string, error) {
	out, err := Process(r)
	if err != nil {
		return "", err
	}
	key := NewKey()
	if err := os.MkdirAll(filepath.Join(s.dir, filepath.Dir(key)), 0o755); err != nil {
		return "", err
	}
	if err := s.write(key+".jpg", out.Display.Bytes); err != nil {
		return "", err
	}
	if err := s.write(key+"_t.jpg", out.Thumb.Bytes); err != nil {
		_ = os.Remove(filepath.Join(s.dir, key+".jpg"))
		return "", err
	}
	return key, nil
}

// write goes via a temp file so a crash mid-write cannot leave a truncated
// image being served.
func (s *DiskStore) write(name string, data []byte) error {
	final := filepath.Join(s.dir, filepath.FromSlash(name))
	tmp, err := os.CreateTemp(filepath.Dir(final), ".tmp-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), final)
}

func (s *DiskStore) Open(_ context.Context, key, variant string) ([]byte, error) {
	b, err := os.ReadFile(filepath.Join(s.dir, filepath.FromSlash(key+s.suffix(variant))))
	if os.IsNotExist(err) {
		return nil, ErrNotFound
	}
	return b, err
}

func (s *DiskStore) Delete(_ context.Context, key string) error {
	if key == "" {
		return nil
	}
	var firstErr error
	for _, variant := range []string{Display, Thumb} {
		err := os.Remove(filepath.Join(s.dir, filepath.FromSlash(key+s.suffix(variant))))
		if err != nil && !os.IsNotExist(err) && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}
