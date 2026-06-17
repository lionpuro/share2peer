package main

import (
	"encoding/json"
	"net/http"
	"os"
	"regexp"
	"strings"
)

func unmarshal[T any](input any) (T, error) {
	var result T
	bytes, err := json.Marshal(input)
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(bytes, &result); err != nil {
		return result, err
	}
	return result, err
}

func getenv(key string, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

func extractIP(header http.Header) string {
	raw := header.Get("x-forwarded-for")
	s := strings.Split(raw, ",")
	if len(s) == 0 {
		return ""
	}

	ip := strings.TrimSpace(s[0])
	if v, ok := strings.CutPrefix(ip, "::ffff:"); ok {
		return v
	}
	if ip == "::1" {
		return "127.0.0.1"
	}
	return ip
}

var ipRegexp = regexp.MustCompile(`(^127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^172\.1[6-9]{1}[0-9]{0,1}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^172\.2[0-9]{1}[0-9]{0,1}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^172\.3[0-1]{1}[0-9]{0,1}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^192\.168\.[0-9]{1,3}\.[0-9]{1,3}$)`)

func getNetworkKey(ip string) string {
	private := ipRegexp.MatchString(ip)
	if private {
		return strings.Join(strings.Split(ip, ".")[:3], ".")
	}
	return ip
}
