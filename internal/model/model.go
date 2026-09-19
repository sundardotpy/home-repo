package model

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Tag is one entry in the vocabulary, with how many items currently use it.
type Tag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// PropertyKey is a custom field in use somewhere, with the values it has been
// given — enough for the UI to autocomplete both halves.
type PropertyKey struct {
	Key    string   `json:"key"`
	Count  int      `json:"count"`
	Values []string `json:"values"`
}

type User struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     *string   `json:"email,omitempty"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
}

type Room struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sort_order"`
	Floor       int       `json:"floor"`
	FloorName   string    `json:"floor_name"`
	FloorLabel  string    `json:"floor_label"` // derived; what the UI shows
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Populated on list/read, not on write.
	StorageUnitCount int `json:"storage_unit_count"`
	ItemCount        int `json:"item_count"`
}

type StorageUnit struct {
	ID          uuid.UUID  `json:"id"`
	RoomID      uuid.UUID  `json:"room_id"`
	ParentID    *uuid.UUID `json:"parent_id"`
	Name        string     `json:"name"`
	Kind        string     `json:"kind"`
	Description string     `json:"description"`
	QRSlug      string     `json:"qr_slug"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	RoomName  string         `json:"room_name,omitempty"`
	Path      []string       `json:"path,omitempty"`  // ["Bedroom","Wardrobe","Top Shelf"]
	Depth     int            `json:"depth,omitempty"` // 1 = directly in the room
	ItemCount int            `json:"item_count"`
	Children  []*StorageUnit `json:"children,omitempty"`
}

// FloorLabel turns a floor number into something readable. An explicit name
// always wins, for the floors a number cannot describe.
func FloorLabel(floor int, name string) string {
	if n := strings.TrimSpace(name); n != "" {
		return n
	}
	switch {
	case floor == 0:
		return "Ground floor"
	case floor == -1:
		return "Basement"
	case floor < -1:
		return fmt.Sprintf("Basement %d", -floor)
	default:
		return fmt.Sprintf("%s floor", ordinal(floor))
	}
}

func ordinal(n int) string {
	suffix := "th"
	switch {
	case n%100 >= 11 && n%100 <= 13: // 11th, 12th, 13th
	case n%10 == 1:
		suffix = "st"
	case n%10 == 2:
		suffix = "nd"
	case n%10 == 3:
		suffix = "rd"
	}
	return fmt.Sprintf("%d%s", n, suffix)
}

// Location is the "where is it" answer the search bar returns.
type Location struct {
	RoomID        uuid.UUID  `json:"room_id"`
	RoomName      string     `json:"room_name"`
	Floor         int        `json:"floor"`
	FloorLabel    string     `json:"floor_label"`
	StorageUnitID *uuid.UUID `json:"storage_unit_id"`
	Path          []string   `json:"path"`        // ["Bedroom","Wardrobe","Top Shelf"]
	PathString    string     `json:"path_string"` // "Bedroom > Wardrobe > Top Shelf"
}

func NewLocation(roomID uuid.UUID, roomName string, floor int, floorName string, unitID *uuid.UUID, unitPath []string) Location {
	path := append([]string{roomName}, unitPath...)
	return Location{
		RoomID:        roomID,
		RoomName:      roomName,
		Floor:         floor,
		FloorLabel:    FloorLabel(floor, floorName),
		StorageUnitID: unitID,
		Path:          path,
		// The floor stays out of the path string: it is only worth showing when
		// a home actually has more than one, which the UI decides.
		PathString: strings.Join(path, " > "),
	}
}

// PhotoURLs derives the public URLs from a stored photo key. Only the key
// lives in the database, so the layout on disk can change without a migration.
func PhotoURLs(key *string) (full, thumb string) {
	if key == nil || *key == "" {
		return "", ""
	}
	return "/media/" + *key + ".jpg", "/media/" + *key + "_t.jpg"
}

type Item struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Quantity    int       `json:"quantity"`
	Tags        []string  `json:"tags"`
	Icon        string    `json:"icon"`
	Barcode     string    `json:"barcode"` // a manufacturer's code, when the product has one

	// Properties are user-defined fields: any key, any value. Ordering is not
	// preserved by jsonb, so the UI sorts them.
	Properties    map[string]string `json:"properties"`
	RoomID        uuid.UUID         `json:"room_id"`
	StorageUnitID *uuid.UUID        `json:"storage_unit_id"`
	PhotoPath     *string           `json:"photo_path"`
	PhotoURL      string            `json:"photo_url,omitempty"`
	PhotoThumbURL string            `json:"photo_thumb_url,omitempty"`
	CreatedBy     *uuid.UUID        `json:"created_by"`
	UpdatedBy     *uuid.UUID        `json:"updated_by"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`

	Location *Location `json:"location,omitempty"`
}
