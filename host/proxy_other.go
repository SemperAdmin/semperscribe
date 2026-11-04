//go:build !windows

package main

import (
	"net/http"
	"net/url"
)

// systemProxy on a non-Windows build falls back to the environment, which
// is the platform convention everywhere except Windows.
func systemProxy() func(*http.Request) (*url.URL, error) {
	return http.ProxyFromEnvironment
}
