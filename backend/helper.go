package main

import (
	"encoding/json"
	"os"
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
