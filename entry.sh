#!/bin/bash

trap exit EXIT

wgo -debounce 100ms -xdir web \
	go run ./server/*.go \
	:: wgo -xdir . npm run dev -w web
