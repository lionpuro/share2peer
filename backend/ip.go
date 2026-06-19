package main

import (
	"net/netip"
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

func getNetworkIdentifier(addr netip.Addr) string {
	if !addr.IsValid() {
		return ""
	}
	ip := addr.Unmap()
	switch {
	case ip.Is4():
		if ip.IsPrivate() {
			return netip.PrefixFrom(ip, 24).Masked().String()
		}
		return ip.String()
	case ip.Is6():
		return netip.PrefixFrom(ip, 64).Masked().String()
	default:
		return ip.String()
	}
}
