#!/bin/bash

MIGRATION_DIR=./migrations

create() {
	read -p "Enter a name: " SEQ; \
		migrate create -ext sql -dir ${MIGRATION_DIR} -seq ${SEQ}
}

up() {
	migrate -path ${MIGRATION_DIR} -database "${DATABASE_URL}" up
}

down() {
	read -p "Number of migrations you want to rollback (default: 1): " NUM; NUM=${NUM:-1}; \
		migrate -path ${MIGRATION_DIR} -database "${DATABASE_URL}" down ${NUM}
}

force() {
	read -p "Enter the version to force: " VERSION; \
		migrate -path ${MIGRATION_DIR} -database "${DATABASE_URL}" force ${VERSION}
}

usage() {
	echo "Usage: $0 [COMMAND] [ARGUMENTS]"
	echo "Commands:"
	echo "  create    create migration"
	echo "  up        run migrations"
	echo "  down      roll back migrations"
	echo "  force     force version"
}

fn_exists() {
    type $1 2>/dev/null | grep -q 'is a function'
}

fn_exists $1
if [ $? -eq 0 ]; then
	$1
else
	usage
fi
