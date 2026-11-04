// SemperScribe local host.
//
// One executable. It serves the SemperScribe static build on loopback and
// forwards /api/* to the GenAI.mil gateway.
//
// WHY THIS SHAPE. api.genai.mil sends no CORS headers and refuses the
// anonymous preflight. Measured on government workstations, two machines,
// two network paths, and both published base URLs. See
// docs/GENAI_MIL_CORS_DEFECT_REPORT.md. A browser page on any other origin
// therefore cannot call it, and no application code changes that.
//
// Serving the page from this same binary makes the API call SAME-ORIGIN.
// Same-origin requests carry no CORS check, generate no preflight, need no
// Access-Control-Allow-Origin, and trigger no Chrome Local Network Access
// prompt. The problem stops existing rather than getting worked around.
//
// Build:
//
//	set DEPLOY_TARGET=cloudgov && npm run build      (produces out/)
//	xcopy /E /I /Y out webroot
//	set GOOS=windows& set GOARCH=amd64& set CGO_ENABLED=0
//	go build -trimpath -ldflags "-s -w" -o SemperScribe.exe
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// The SemperScribe static export, compiled into the binary. Build it with
// DEPLOY_TARGET=cloudgov so next.config.ts resolves basePath to the empty
// string and the site is servable from a root.
//
//go:embed all:webroot
var webroot embed.FS

const upstream = "https://api.genai.mil"

// Paths this host is willing to forward. An open forwarder on loopback is
// a hazard, so the allowlist is explicit and short. Extend it deliberately.
var allowedPaths = map[string]string{
	"/api/v1/chat/completions": http.MethodPost,
	"/api/v1/embeddings":       http.MethodPost,
	"/api/v1/models":           http.MethodGet,
}

// sessionOrigin is the origin this process is serving, filled once the
// listener has a port. Every /api request must come from it.
var sessionOrigin string

func main() {
	port := flag.Int("port", 0, "loopback port, 0 picks a free one")
	noOpen := flag.Bool("no-open", false, "do not launch a browser")
	flag.Parse()

	// Loopback ONLY. Binding 0.0.0.0 would publish a GenAI.mil forwarder to
	// the local network, which is the opposite of the point.
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		log.Fatalf("cannot bind loopback: %v", err)
	}
	actual := ln.Addr().(*net.TCPAddr).Port
	sessionOrigin = fmt.Sprintf("http://127.0.0.1:%d", actual)

	sub, err := fs.Sub(webroot, "webroot")
	if err != nil {
		log.Fatalf("embedded webroot unreadable: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/api/", http.HandlerFunc(proxyHandler))
	mux.Handle("/", noStore(http.FileServer(http.FS(sub))))

	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	fmt.Println("SemperScribe is running at " + sessionOrigin)
	fmt.Println("In GunnyBot settings set the provider proxy URL to:")
	fmt.Println("    " + sessionOrigin + "/api")
	fmt.Println("Leave this window open. Close it to stop.")

	if !*noOpen {
		openBrowser(sessionOrigin + "/")
	}
	log.Fatal(srv.Serve(ln))
}

// noStore keeps a stale build out of the browser cache across upgrades.
func noStore(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h.ServeHTTP(w, r)
	})
}

// client carries the Windows proxy resolution and, through the platform
// verifier, the machine's certificate trust.
//
// TLS TRUST. On Windows, Go builds and validates chains with
// CertGetCertificateChain, the same Windows API Chrome relies on, so roots
// an organization installs through policy are honored with no extra code
// and no certificate bundle shipped beside the binary. This is the problem
// AegisCode had to solve in Python with a truststore shim. Go has it built
// in. Do NOT set RootCAs: an explicit pool REPLACES the platform verifier
// and breaks every ordinary site.
//
// PROXY. Go resolves only HTTP_PROXY and HTTPS_PROXY out of the box, which
// misses the WinINET static setting and the PAC script a managed machine
// actually uses. On Windows, replace the Proxy field with
// ieproxy.GetProxyFunc() from github.com/mattn/go-ieproxy in a
// windows-tagged file. Keep this default for every other platform.
var client = &http.Client{
	Timeout: 120 * time.Second,
	Transport: &http.Transport{
		Proxy:               systemProxy(),
		MaxIdleConns:        10,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 20 * time.Second,
	},
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// proxyHandler forwards one allowlisted request to the gateway.
//
// DELIBERATELY NO CORS HEADERS. This is a security control, not an
// oversight. Any website the user visits is able to aim a request at
// loopback. Without Access-Control-Allow-Origin, a page on another origin
// fails its preflight and never gets to send the Authorization header, and
// is unable to read a response even where one came back. The SemperScribe
// page is served by this same process, so it is same-origin and needs
// nothing. Adding CORS here to "make it work" would open the forwarder to
// the whole web.
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	// Second lock. Origin is set by the browser and is not forgeable by
	// page script. Same-origin fetches often omit it, so absent is allowed
	// and a foreign value is not.
	if o := r.Header.Get("Origin"); o != "" && o != sessionOrigin {
		writeErr(w, http.StatusForbidden, "This endpoint serves the local SemperScribe page only.")
		return
	}
	// Reject a cross-site navigation or form post outright.
	if s := r.Header.Get("Sec-Fetch-Site"); s != "" && s != "same-origin" && s != "none" {
		writeErr(w, http.StatusForbidden, "Cross-site request refused.")
		return
	}

	want, ok := allowedPaths[r.URL.Path]
	if !ok {
		writeErr(w, http.StatusNotFound, "Path "+r.URL.Path+" is not forwarded by this host.")
		return
	}
	if r.Method != want {
		writeErr(w, http.StatusMethodNotAllowed, "Use "+want+" on this path.")
		return
	}

	auth := r.Header.Get("Authorization")
	if auth == "" {
		writeErr(w, http.StatusUnauthorized, "No API key was sent. Save your GenAI.mil key in GunnyBot settings.")
		return
	}

	target := upstream + strings.TrimPrefix(r.URL.Path, "/api")
	if r.URL.RawQuery != "" {
		target += "?" + r.URL.RawQuery
	}

	ctx, cancel := context.WithTimeout(r.Context(), 115*time.Second)
	defer cancel()

	// Body is streamed. Nothing is buffered to disk and nothing is logged.
	req, err := http.NewRequestWithContext(ctx, r.Method, target, r.Body)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Could not build the upstream request.")
		return
	}
	// Forward only what the gateway needs. The key passes through and is
	// never stored, never written to disk, and never printed.
	req.Header.Set("Authorization", auth)
	if ct := r.Header.Get("Content-Type"); ct != "" {
		req.Header.Set("Content-Type", ct)
	}
	req.Header.Set("Accept", "application/json")

	res, err := client.Do(req)
	if err != nil {
		writeErr(w, http.StatusBadGateway, explainDialFailure(err))
		return
	}
	defer res.Body.Close()

	// STARK keys lock on a schedule and need a CAC-driven unlock, so a 401
	// here is routine rather than a broken key. Say so, and say where to go.
	if res.StatusCode == http.StatusUnauthorized {
		writeErr(w, http.StatusUnauthorized,
			"GenAI.mil refused the key with 401. STARK keys lock periodically and need a CAC unlock. "+
				"Open https://genai.mil/stark/user-ui/docs, unlock or reissue the key, save it again in GunnyBot settings, and retry.")
		return
	}

	// The fence. Measured 2026-09-20 from a commercial network: the gateway
	// answers with HTTP 503 and an HTML page reading "You have reached this
	// page because you are not authorized to visit GenAI.mil from outside of
	// DoW networks." Passing that HTML into a JSON client produces a parse
	// error and a useless message, so name the real cause instead.
	if res.StatusCode == http.StatusServiceUnavailable &&
		strings.Contains(res.Header.Get("Content-Type"), "text/html") {
		writeErr(w, http.StatusServiceUnavailable,
			"GenAI.mil returned its block page. This workstation is not on a government network right now. "+
				"Connect to the government network and retry. GenAI.mil is fenced and refuses everything outside it, "+
				"which is also why no cloud-hosted backend reaches it.")
		return
	}

	if ct := res.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.WriteHeader(res.StatusCode)
	_, _ = io.Copy(w, res.Body)
}

// explainDialFailure turns a transport error into something a Marine is
// able to act on. A bare "Post: dial tcp: i/o timeout" tells nobody
// anything, which is the same failure of legibility that made the browser
// CORS abort so expensive to diagnose.
func explainDialFailure(err error) string {
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return "No answer from api.genai.mil within the timeout. Confirm you are on the government network, " +
			"then check the proxy settings this workstation uses."
	}
	s := err.Error()
	switch {
	case strings.Contains(s, "certificate"):
		return "TLS trust failure reaching api.genai.mil. The workstation's certificate store is missing a root " +
			"this connection needs. Report this, it is a machine configuration problem rather than an app problem."
	case strings.Contains(s, "no such host"):
		return "api.genai.mil did not resolve. Confirm you are on the government network."
	case strings.Contains(s, "proxyconnect"), strings.Contains(s, "Forbidden"):
		return "The site proxy refused the connection to api.genai.mil. This host is fenced to government networks."
	}
	return "Could not reach api.genai.mil: " + s
}

func openBrowser(raw string) {
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() != "127.0.0.1" {
		return
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", raw)
	case "darwin":
		cmd = exec.Command("open", raw)
	default:
		cmd = exec.Command("xdg-open", raw)
	}
	_ = cmd.Start()
}
