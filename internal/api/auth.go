package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// A single shared passcode, for a household app with no accounts. When
// APP_PASSCODE is set every data route (the API and the photos) demands a
// session cookie; when it is not, nothing changes. The app shell itself is
// public: it holds no data.
//
// The cookie is stateless — an expiry signed with a key derived from the
// passcode — because a serverless deployment has no memory between requests.
// Changing the passcode therefore signs everyone out.

const (
	sessionCookie = "hr_session"
	sessionTTL    = 30 * 24 * time.Hour

	maxFailures   = 5
	failureWindow = 15 * time.Minute
)

// SetPasscode turns the gate on. An empty passcode leaves the app open.
func (s *Server) SetPasscode(p string) { s.passcode = p }

func (s *Server) sessionKey() []byte {
	sum := sha256.Sum256([]byte("home-repo-session|" + s.passcode))
	return sum[:]
}

func (s *Server) sign(exp int64) string {
	msg := "v1." + strconv.FormatInt(exp, 10)
	mac := hmac.New(sha256.New, s.sessionKey())
	mac.Write([]byte(msg))
	return msg + "." + hex.EncodeToString(mac.Sum(nil))
}

func (s *Server) validToken(tok string, now time.Time) bool {
	parts := strings.Split(tok, ".")
	if len(parts) != 3 || parts[0] != "v1" {
		return false
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || now.Unix() > exp {
		return false
	}
	return hmac.Equal([]byte(s.sign(exp)), []byte(tok))
}

func (s *Server) authed(r *http.Request) bool {
	if s.passcode == "" {
		return true
	}
	c, err := r.Cookie(sessionCookie)
	return err == nil && s.validToken(c.Value, time.Now())
}

// requireAuth guards a handler. Used for photos, which are plain <img> loads.
func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.authed(r) {
			writeErr(w, http.StatusUnauthorized, "passcode required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// apiGate guards everything under /api except the routes needed to get in.
func (s *Server) apiGate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/healthz", "/api/session", "/api/login", "/api/logout":
			next.ServeHTTP(w, r)
			return
		}
		s.requireAuth(next).ServeHTTP(w, r)
	})
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

func (s *Server) session(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{
		"required": s.passcode != "",
		"authed":   s.authed(r),
	})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if s.passcode == "" {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	var b struct {
		Passcode string `json:"passcode"`
	}
	if !decode(w, r, &b) {
		return
	}

	ip := r.RemoteAddr
	if s.tooManyFailures(ip) {
		writeErr(w, http.StatusTooManyRequests, "too many wrong attempts, try again in a few minutes")
		return
	}

	// Digests, so the comparison does not depend on the passcode's length.
	got, want := sha256.Sum256([]byte(b.Passcode)), sha256.Sum256([]byte(s.passcode))
	if subtle.ConstantTimeCompare(got[:], want[:]) != 1 {
		s.noteFailure(ip)
		time.Sleep(700 * time.Millisecond) // a wrong guess is never quick
		writeErr(w, http.StatusUnauthorized, "that is not the passcode")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    s.sign(time.Now().Add(sessionTTL).Unix()),
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: isHTTPS(r), SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// Failed attempts per address, in memory. On a serverless host each instance
// counts for itself, so this slows guessing rather than stopping it: the real
// defence is a long passcode, which is why a short one is refused at startup.
var failures = struct {
	sync.Mutex
	at map[string][]time.Time
}{at: map[string][]time.Time{}}

func recent(ts []time.Time, now time.Time) []time.Time {
	out := ts[:0]
	for _, t := range ts {
		if now.Sub(t) < failureWindow {
			out = append(out, t)
		}
	}
	return out
}

func (s *Server) tooManyFailures(ip string) bool {
	failures.Lock()
	defer failures.Unlock()
	failures.at[ip] = recent(failures.at[ip], time.Now())
	return len(failures.at[ip]) >= maxFailures
}

func (s *Server) noteFailure(ip string) {
	failures.Lock()
	defer failures.Unlock()
	failures.at[ip] = append(recent(failures.at[ip], time.Now()), time.Now())
}
