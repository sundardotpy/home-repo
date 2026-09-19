// Package media takes whatever a phone camera produces and turns it into two
// predictable JPEGs: a display image and a thumbnail.
package media

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png" // register decoders
	"io"
	"path/filepath"

	"github.com/google/uuid"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	// Long-edge caps. 1600 is enough to pinch-zoom a label on a box; beyond
	// that we are just storing camera noise.
	displayMax = 1600
	thumbMax   = 400

	displayQuality = 82
	thumbQuality   = 75

	// MaxUpload is generous enough for a modern phone photo and small enough
	// that a bad request cannot exhaust memory.
	MaxUpload = 15 << 20
)

var (
	ErrUnsupported = errors.New("unsupported image format")
	ErrTooLarge    = errors.New("image too large")
	ErrNotFound    = errors.New("photo not found")
)

// Variants of a stored photo.
const (
	Display = "display"
	Thumb   = "thumb"
)

// Store keeps rendered photos somewhere durable.
type Store interface {
	// Save processes an upload and returns the key both variants share.
	Save(ctx context.Context, r io.Reader) (string, error)
	// Open returns JPEG bytes for one variant of a key.
	Open(ctx context.Context, key, variant string) ([]byte, error)
	// Delete removes every variant of a key. Missing keys are not an error.
	Delete(ctx context.Context, key string) error
}

// Rendition is one output size.
type Rendition struct {
	Bytes         []byte
	Width, Height int
}

// Processed holds both sizes produced from a single upload.
type Processed struct {
	Display Rendition
	Thumb   Rendition
}

// NewKey identifies a photo. Keys are content-free and never reused, which is
// what lets the URLs be cached forever.
func NewKey() string {
	id := uuid.NewString()
	return filepath.ToSlash(filepath.Join("items", id[:2], id))
}

// Process decodes, rotates and re-encodes an upload into both sizes.
//
// Re-encoding is deliberate: it normalises the format and drops EXIF —
// including the GPS coordinates phones attach — from everything served.
func Process(r io.Reader) (Processed, error) {
	var out Processed

	raw, err := io.ReadAll(io.LimitReader(r, MaxUpload+1))
	if err != nil {
		return out, err
	}
	if len(raw) > MaxUpload {
		return out, ErrTooLarge
	}

	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return out, fmt.Errorf("%w: %v", ErrUnsupported, err)
	}
	// Phones record rotation in EXIF rather than in the pixels.
	img = applyOrientation(img, orientationOf(raw))

	if out.Display, err = encode(fit(img, displayMax), displayQuality); err != nil {
		return out, err
	}
	if out.Thumb, err = encode(fit(img, thumbMax), thumbQuality); err != nil {
		return out, err
	}
	return out, nil
}

func encode(img image.Image, quality int) (Rendition, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return Rendition{}, err
	}
	b := img.Bounds()
	return Rendition{Bytes: buf.Bytes(), Width: b.Dx(), Height: b.Dy()}, nil
}

// fit scales an image down so its long edge is at most max, preserving aspect
// ratio. Images already smaller are left alone rather than upscaled.
func fit(src image.Image, max int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= max && h <= max {
		return src
	}
	if w > h {
		h = h * max / w
		w = max
	} else {
		w = w * max / h
		h = max
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}

// VariantFromPath maps a request path suffix to a variant: `<key>_t.jpg` is the
// thumbnail, `<key>.jpg` the display image.
func VariantFromPath(p string) (key, variant string, ok bool) {
	switch {
	case len(p) > 6 && p[len(p)-6:] == "_t.jpg":
		return p[:len(p)-6], Thumb, true
	case len(p) > 4 && p[len(p)-4:] == ".jpg":
		return p[:len(p)-4], Display, true
	default:
		return "", "", false
	}
}
