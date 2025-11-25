#!/bin/bash

trap exit EXIT

wgo -cd server -debounce 100ms -xdir web go run . \
	:: wgo -xdir . npm run dev -w web
