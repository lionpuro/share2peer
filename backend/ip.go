package main

import (
	"net/netip"
	"regexp"
	"strings"
)

// parseIP parses the first IP address found in input. The string input can be
// a single address or a comma separated list of addresses.
func parseIP(input string) (netip.Addr, bool) {
	raw := strings.TrimSpace(strings.Split(input, ",")[0])
	if len(raw) == 0 {
		return netip.Addr{}, false
	}

	ip, err := netip.ParseAddr(raw)
	if err != nil {
		return netip.Addr{}, false
	}

	return ip.Unmap(), true
}

var ipRegexp = regexp.MustCompile(`(^127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^172\.1[6-9]{1}[0-9]{0,1}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^172\.2[0-9]{1}[0-9]{0,1}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^172\.3[0-1]{1}[0-9]{0,1}\.[0-9]{1,3}\.[0-9]{1,3}$)|(^192\.168\.[0-9]{1,3}\.[0-9]{1,3}$)`)

func getNetworkKey(ip string) string {
       private := ipRegexp.MatchString(ip)
       if private {
               return strings.Join(strings.Split(ip, ".")[:3], ".")
       }
       return ip
}
