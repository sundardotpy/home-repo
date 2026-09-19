// Package qr renders storage-unit label codes.
//
// Labels get printed once and then live on a box for years, so SVG is the
// primary output: it stays sharp at any label size and on any printer. PNG is
// there for anything that cannot place an SVG.
package qr

import (
	"bytes"
	"fmt"

	"rsc.io/qr"
)

// Level M tolerates ~15% damage — the right trade for a sticker that will be
// scuffed, taped over and photographed at an angle.
const level = qr.M

// SVG renders the code as a self-contained SVG. The image is a unit square
// scaled by viewBox, so the caller sizes it purely with CSS.
func SVG(text string) ([]byte, error) {
	code, err := qr.Encode(text, level)
	if err != nil {
		return nil, fmt.Errorf("encode qr: %w", err)
	}

	const quiet = 2 // modules of mandatory white border
	size := code.Size + quiet*2

	var b bytes.Buffer
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" `+
		`shape-rendering="crispEdges" role="img" aria-label="QR code">`, size, size)
	b.WriteString(`<rect width="100%" height="100%" fill="#fff"/>`)

	// Emit each row's dark modules as one path segment rather than thousands of
	// <rect> elements; it keeps the file small enough to inline in a print page.
	b.WriteString(`<path fill="#000" d="`)
	for y := 0; y < code.Size; y++ {
		runStart := -1
		for x := 0; x <= code.Size; x++ {
			dark := x < code.Size && code.Black(x, y)
			switch {
			case dark && runStart < 0:
				runStart = x
			case !dark && runStart >= 0:
				fmt.Fprintf(&b, "M%d %dh%dv1H%dz", runStart+quiet, y+quiet, x-runStart, runStart+quiet)
				runStart = -1
			}
		}
	}
	b.WriteString(`"/></svg>`)
	return b.Bytes(), nil
}

// PNG renders the code as a raster image, for contexts that cannot use SVG.
func PNG(text string) ([]byte, error) {
	code, err := qr.Encode(text, level)
	if err != nil {
		return nil, fmt.Errorf("encode qr: %w", err)
	}
	code.Scale = 8 // ~8px per module: comfortably scannable from a screen
	return code.PNG(), nil
}
