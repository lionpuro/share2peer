#!/bin/bash

trap exit EXIT

wgo -cd backend -debounce 100ms -xdir frontend go run . \
	:: wgo -xdir . npm run dev -w frontend
