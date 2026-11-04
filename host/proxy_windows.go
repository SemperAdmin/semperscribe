//go:build windows

package main

import (
	"net/http"
	"net/url"

	"github.com/mattn/go-ieproxy"
)

// systemProxy resolves the proxy this workstation actually uses.
//
// Go's own http.ProxyFromEnvironment reads only HTTP_PROXY and HTTPS_PROXY.
// A managed Windows machine configures its proxy through WinINET, either as
// a static setting or as a PAC script URL, and neither reaches those
// environment variables. ieproxy.GetProxyFunc calls
// WinHttpGetIEProxyConfigForCurrentUser with a registry fallback, covering
// the static setting, an explicit PAC script, and WPAD autodiscovery, in
// that order. This is the same resolution order AegisCode implements by
// hand in Python.
func systemProxy() func(*http.Request) (*url.URL, error) {
	return ieproxy.GetProxyFunc()
}
