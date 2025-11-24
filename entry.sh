#!/bin/bash

trap exit EXIT

wgo -debounce 100ms -xdir web \
	go run ./server/*.go \
	:: wgo -xdir web -xdir server npm run dev -w web
