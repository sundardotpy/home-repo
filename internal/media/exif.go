package media

import (
	"encoding/binary"
	"image"
	"image/draw"
)

// A photo taken with the phone held sideways is stored unrotated, with a flag
// in EXIF saying how to turn it. Browsers honour that flag for the original
// file — but we re-encode, which drops it, so the rotation has to be baked into
// the pixels or every second photo ends up on its side.
//
// This reads just tag 0x0112 (Orientation) out of the JPEG's APP1 segment,
// which is all we need from EXIF.
func orientationOf(raw []byte) int {
	const normal = 1
	if len(raw) < 4 || raw[0] != 0xFF || raw[1] != 0xD8 {
		return normal // not a JPEG; PNG and WebP have no orientation tag
	}

	// Walk the JPEG marker segments looking for APP1/Exif.
	for i := 2; i+4 <= len(raw); {
		if raw[i] != 0xFF {
			return normal
		}
		marker := raw[i+1]
		if marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7) {
			i += 2
			continue
		}
		if marker == 0xDA { // start of scan: no metadata beyond here
			return normal
		}
		size := int(binary.BigEndian.Uint16(raw[i+2 : i+4]))
		if size < 2 || i+2+size > len(raw) {
			return normal
		}
		seg := raw[i+4 : i+2+size]
		if marker == 0xE1 && len(seg) > 6 && string(seg[:4]) == "Exif" {
			if o := orientationFromTIFF(seg[6:]); o != 0 {
				return o
			}
			return normal
		}
		i += 2 + size
	}
	return normal
}

func orientationFromTIFF(tiff []byte) int {
	if len(tiff) < 8 {
		return 0
	}
	var bo binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return 0
	}

	offset := int(bo.Uint32(tiff[4:8]))
	if offset+2 > len(tiff) {
		return 0
	}
	count := int(bo.Uint16(tiff[offset : offset+2]))
	for i := 0; i < count; i++ {
		e := offset + 2 + i*12
		if e+12 > len(tiff) {
			return 0
		}
		if bo.Uint16(tiff[e:e+2]) != 0x0112 {
			continue
		}
		// Values that fit in four bytes are stored inline.
		v := int(bo.Uint16(tiff[e+8 : e+10]))
		if v >= 1 && v <= 8 {
			return v
		}
		return 0
	}
	return 0
}

// applyOrientation bakes the EXIF flag into the pixels. Values 1-8 cover the
// eight combinations of rotation and mirroring the spec allows.
func applyOrientation(src image.Image, orientation int) image.Image {
	switch orientation {
	case 2:
		return flipH(src)
	case 3:
		return rotate180(src)
	case 4:
		return flipV(src)
	case 5:
		return transpose(src)
	case 6:
		return rotate90(src)
	case 7:
		return transverse(src)
	case 8:
		return rotate270(src)
	default:
		return src
	}
}

func newLike(src image.Image, swap bool) *image.RGBA {
	b := src.Bounds()
	if swap {
		return image.NewRGBA(image.Rect(0, 0, b.Dy(), b.Dx()))
	}
	return image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
}

// remap copies every pixel through a coordinate transform. These images have
// already been bounded by MaxUpload, so a straightforward per-pixel loop is
// fine and keeps the eight cases readable.
func remap(src image.Image, swap bool, fn func(x, y, w, h int) (int, int)) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	dst := newLike(src, swap)
	draw.Draw(dst, dst.Bounds(), image.Transparent, image.Point{}, draw.Src)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			dx, dy := fn(x, y, w, h)
			dst.Set(dx, dy, src.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

func flipH(s image.Image) image.Image {
	return remap(s, false, func(x, y, w, _ int) (int, int) { return w - 1 - x, y })
}

func flipV(s image.Image) image.Image {
	return remap(s, false, func(x, y, _, h int) (int, int) { return x, h - 1 - y })
}

func rotate180(s image.Image) image.Image {
	return remap(s, false, func(x, y, w, h int) (int, int) { return w - 1 - x, h - 1 - y })
}

func rotate90(s image.Image) image.Image {
	return remap(s, true, func(x, y, _, h int) (int, int) { return h - 1 - y, x })
}

func rotate270(s image.Image) image.Image {
	return remap(s, true, func(x, y, w, _ int) (int, int) { return y, w - 1 - x })
}

func transpose(s image.Image) image.Image {
	return remap(s, true, func(x, y, _, _ int) (int, int) { return y, x })
}

func transverse(s image.Image) image.Image {
	return remap(s, true, func(x, y, w, h int) (int, int) { return h - 1 - y, w - 1 - x })
}
