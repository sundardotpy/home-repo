package media

import (
	"bytes"
	"context"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// gradient makes a recognisable test image: the top-left corner is dark, so
// rotations are detectable by sampling corners.
func gradient(w, h int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(255 * x / w), G: uint8(255 * y / h), B: 40, A: 255})
		}
	}
	return img
}

func encodeJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encode: %v", err)
	}
	return buf.Bytes()
}

// withOrientation splices a minimal EXIF APP1 segment carrying only the
// orientation tag directly after the JPEG's SOI marker.
func withOrientation(t *testing.T, jpg []byte, orientation uint16) []byte {
	t.Helper()

	var tiff bytes.Buffer
	tiff.WriteString("II")                                   // little endian
	binary.Write(&tiff, binary.LittleEndian, uint16(0x002A)) // magic
	binary.Write(&tiff, binary.LittleEndian, uint32(8))      // IFD0 offset
	binary.Write(&tiff, binary.LittleEndian, uint16(1))      // one entry
	binary.Write(&tiff, binary.LittleEndian, uint16(0x0112)) // Orientation
	binary.Write(&tiff, binary.LittleEndian, uint16(3))      // SHORT
	binary.Write(&tiff, binary.LittleEndian, uint32(1))      // count
	binary.Write(&tiff, binary.LittleEndian, orientation)
	binary.Write(&tiff, binary.LittleEndian, uint16(0)) // padding
	binary.Write(&tiff, binary.LittleEndian, uint32(0)) // no next IFD

	payload := append([]byte("Exif\x00\x00"), tiff.Bytes()...)

	var out bytes.Buffer
	out.Write(jpg[:2]) // SOI
	out.Write([]byte{0xFF, 0xE1})
	binary.Write(&out, binary.BigEndian, uint16(len(payload)+2))
	out.Write(payload)
	out.Write(jpg[2:])
	return out.Bytes()
}

func TestOrientationOf(t *testing.T) {
	plain := encodeJPEG(t, gradient(20, 10))
	if got := orientationOf(plain); got != 1 {
		t.Errorf("plain JPEG: got orientation %d, want 1", got)
	}
	for _, want := range []uint16{3, 6, 8} {
		if got := orientationOf(withOrientation(t, plain, want)); got != int(want) {
			t.Errorf("tagged JPEG: got orientation %d, want %d", got, want)
		}
	}
	if got := orientationOf([]byte("not a jpeg")); got != 1 {
		t.Errorf("non-JPEG: got %d, want 1 (default)", got)
	}
}

func TestApplyOrientationSwapsSidesForQuarterTurns(t *testing.T) {
	src := gradient(40, 20)
	for _, o := range []int{5, 6, 7, 8} {
		b := applyOrientation(src, o).Bounds()
		if b.Dx() != 20 || b.Dy() != 40 {
			t.Errorf("orientation %d: got %dx%d, want 20x40", o, b.Dx(), b.Dy())
		}
	}
	for _, o := range []int{1, 2, 3, 4} {
		b := applyOrientation(src, o).Bounds()
		if b.Dx() != 40 || b.Dy() != 20 {
			t.Errorf("orientation %d: got %dx%d, want 40x20", o, b.Dx(), b.Dy())
		}
	}
}

func TestFit(t *testing.T) {
	cases := []struct{ w, h, max, wantW, wantH int }{
		{2000, 1000, 400, 400, 200}, // landscape
		{1000, 2000, 400, 200, 400}, // portrait
		{300, 200, 400, 300, 200},   // already small: untouched, never upscaled
	}
	for _, c := range cases {
		b := fit(gradient(c.w, c.h), c.max).Bounds()
		if b.Dx() != c.wantW || b.Dy() != c.wantH {
			t.Errorf("fit(%dx%d, %d): got %dx%d, want %dx%d",
				c.w, c.h, c.max, b.Dx(), b.Dy(), c.wantW, c.wantH)
		}
	}
}

func dimsOf(t *testing.T, path string) (int, int) {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatalf("open %s: %v", path, err)
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
	return cfg.Width, cfg.Height
}

func TestSaveWritesBothSizes(t *testing.T) {
	s, err := NewDiskStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	key, err := s.Save(context.Background(), bytes.NewReader(encodeJPEG(t, gradient(2400, 1200))))
	if err != nil {
		t.Fatalf("save: %v", err)
	}

	w, h := dimsOf(t, filepath.Join(s.Dir(), key+".jpg"))
	if w != displayMax || h != displayMax/2 {
		t.Errorf("display image: got %dx%d, want %dx%d", w, h, displayMax, displayMax/2)
	}
	tw, th := dimsOf(t, filepath.Join(s.Dir(), key+"_t.jpg"))
	if tw != thumbMax || th != thumbMax/2 {
		t.Errorf("thumbnail: got %dx%d, want %dx%d", tw, th, thumbMax, thumbMax/2)
	}
}

// A sideways phone photo must come out upright, because re-encoding drops the
// EXIF flag that browsers would otherwise have honoured.
func TestSaveBakesInRotation(t *testing.T) {
	s, err := NewDiskStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	rotated := withOrientation(t, encodeJPEG(t, gradient(1200, 600)), 6)
	key, err := s.Save(context.Background(), bytes.NewReader(rotated))
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	w, h := dimsOf(t, filepath.Join(s.Dir(), key+".jpg"))
	if w >= h {
		t.Errorf("orientation 6 should produce a portrait image, got %dx%d", w, h)
	}
}

func TestSaveRejectsJunk(t *testing.T) {
	s, err := NewDiskStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save(context.Background(), strings.NewReader("this is not an image")); err == nil {
		t.Fatal("expected an error for non-image input")
	}
}

func TestSaveRejectsOversized(t *testing.T) {
	s, err := NewDiskStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save(context.Background(), bytes.NewReader(make([]byte, MaxUpload+1))); err != ErrTooLarge {
		t.Fatalf("got %v, want ErrTooLarge", err)
	}
}

func TestDeleteRemovesBothFiles(t *testing.T) {
	s, err := NewDiskStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	key, err := s.Save(context.Background(), bytes.NewReader(encodeJPEG(t, gradient(800, 800))))
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(context.Background(), key); err != nil {
		t.Fatalf("delete: %v", err)
	}
	for _, suffix := range []string{".jpg", "_t.jpg"} {
		if _, err := os.Stat(filepath.Join(s.Dir(), key+suffix)); !os.IsNotExist(err) {
			t.Errorf("%s still present", key+suffix)
		}
	}
	if err := s.Delete(context.Background(), key); err != nil {
		t.Errorf("second delete should be a no-op, got %v", err)
	}
}
