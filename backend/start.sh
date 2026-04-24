#!/bin/bash

set -a; source .env; set +a
wgo -debounce 100ms go run .
