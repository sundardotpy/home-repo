package model

import (
	"testing"
	"time"
)

func TestNewValue(t *testing.T) {
	now := time.Date(2026, 10, 11, 15, 30, 0, 0, time.UTC)
	price := func(p float64) *float64 { return &p }
	on := func(s string) *string { return &s }

	cases := []struct {
		name       string
		price      *float64
		on         *string
		wantNil    bool
		wantDays   int
		wantPerDay float64
	}{
		{"earphones", price(1499), on("2025-01-03"), false, 646, 2.32},
		{"keyboard", price(6499), on("2025-08-20"), false, 417, 15.59},
		{"bought today counts as one day", price(450), on("2026-10-11"), false, 1, 450},
		{"future date is clamped", price(100), on("2027-01-01"), false, 1, 100},
		{"free item", price(0), on("2025-01-03"), false, 646, 0},
		{"no price", nil, on("2025-01-03"), true, 0, 0},
		{"no date", price(10), nil, true, 0, 0},
		{"bad date", price(10), on("03/01/2025"), true, 0, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v := NewValue(c.price, c.on, now)
			if c.wantNil {
				if v != nil {
					t.Fatalf("want nil, got %+v", v)
				}
				return
			}
			if v == nil {
				t.Fatal("want a value, got nil")
			}
			if v.Days != c.wantDays || v.PerDay != c.wantPerDay {
				t.Fatalf("got %d days / %.2f per day, want %d / %.2f", v.Days, v.PerDay, c.wantDays, c.wantPerDay)
			}
		})
	}
}
