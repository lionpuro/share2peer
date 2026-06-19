package main

import (
	"net/netip"
	"testing"
)

func TestParseIP(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
		ok    bool
	}{
		{
			name:  "ipv4",
			input: "203.0.113.10",
			want:  "203.0.113.10",
			ok:    true,
		},
		{
			name:  "ipv4 first in chain",
			input: "67.45.154.228, 121.72.249.10",
			want:  "67.45.154.228",
			ok:    true,
		},
		{
			name:  "ipv6",
			input: "2001:db8::1",
			want:  "2001:db8::1",
			ok:    true,
		},
		{
			name:  "mapped ipv4",
			input: "::ffff:192.168.1.15",
			want:  "192.168.1.15",
			ok:    true,
		},
		{
			name:  "ipv4 with whitespace",
			input: "   192.168.1.20   ",
			want:  "192.168.1.20",
			ok:    true,
		},
		{
			name:  "empty",
			input: "",
			ok:    false,
		},
		{
			name:  "invalid",
			input: "not-an-ip",
			ok:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ip, ok := parseIP(tt.input)
			if ok != tt.ok {
				t.Errorf("wanted ok=%v got ok=%v", tt.ok, ok)
				return
			}
			if ok && ip.String() != tt.want {
				t.Errorf("wanted %s got %s", tt.want, ip.String())
			}
		})
	}
}

func TestGetNetworkIdentifier(t *testing.T) {
	tests := []struct {
		name string
		ip   string
		want string
	}{

		{"public ipv4", "203.0.113.5", "203.0.113.5"},
		{"private ipv4", "192.168.1.42", "192.168.1.0/24"},
		{"ipv6", "2001:db8:abcd:1234::1", "2001:db8:abcd:1234::/64"},
		{"mapped ipv4", "::ffff:192.168.1.42", "192.168.1.0/24"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ip, err := netip.ParseAddr(tt.ip)
			if err != nil {
				t.Fatalf("failed to parse test address: %v", err)
			}
			v := getNetworkIdentifier(ip)
			if v != tt.want {
				t.Errorf("wanted %s got %s", tt.want, v)
			}
		})
	}
}
