#!/bin/sh
set -eu
wl_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
wl_data="$wl_root/.local/mysql"
wl_socket="$wl_root/.local/mysql.sock"
if [ "${1:-start}" = "stop" ]; then
 mysqladmin --socket="$wl_socket" -u root shutdown
 exit 0
fi
if ! mysqladmin --socket="$wl_socket" -u root ping --silent >/dev/null 2>&1; then
 if [ -x /opt/homebrew/opt/mysql@8.0/bin/mysqld ]; then
  wl_binary=/opt/homebrew/opt/mysql@8.0/bin/mysqld
 else
  wl_binary=$(command -v mysqld)
 fi
 mkdir -p "$wl_data"
 if [ ! -d "$wl_data/mysql" ]; then
  "$wl_binary" --no-defaults --initialize-insecure --datadir="$wl_data" --log-error="$wl_root/.local/mysql-init.log"
 fi
 "$wl_binary" --no-defaults --daemonize --datadir="$wl_data" --port=3307 --bind-address=127.0.0.1 --socket="$wl_socket" --mysqlx=OFF --log-error="$wl_root/.local/mysql.log" --pid-file="$wl_root/.local/mysql.pid"
fi
mysql --socket="$wl_socket" -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS wonderlab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS wonderlab_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wonderlab'@'127.0.0.1' IDENTIFIED BY 'local-wonderlab-db';
GRANT ALL ON wonderlab.* TO 'wonderlab'@'127.0.0.1';
GRANT ALL ON wonderlab_test.* TO 'wonderlab'@'127.0.0.1';
SQL
printf '%s\n' 'Isolated development MySQL is ready at 127.0.0.1:3307.'
