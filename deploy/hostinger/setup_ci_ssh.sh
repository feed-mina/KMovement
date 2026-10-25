#!/usr/bin/env bash
# Run once in the trusted Hostinger VPS console. No private key is printed.
set -euo pipefail
umask 077
test "$(hostname)" = 'srv1869569'
test "$(id -u)" = '0'
command -v ssh-keygen >/dev/null
test -r /etc/ssh/ssh_host_ed25519_key.pub
HOSTINGER_CI_DIR='/docker/kmovement-web/ci-access'
install -d -m 0700 "$HOSTINGER_CI_DIR"
install -d -m 0700 /root/.ssh

if [ ! -f "$HOSTINGER_CI_DIR/id_ed25519" ]; then
  ssh-keygen -q -t ed25519 -N '' -C 'kmovement-github-deploy' -f "$HOSTINGER_CI_DIR/id_ed25519"
fi
test -f "$HOSTINGER_CI_DIR/id_ed25519.pub"
touch /root/.ssh/authorized_keys
chmod 0600 /root/.ssh/authorized_keys "$HOSTINGER_CI_DIR/id_ed25519"
if ! grep -Fq -- "$(cat "$HOSTINGER_CI_DIR/id_ed25519.pub")" /root/.ssh/authorized_keys; then
  printf '\nrestrict %s\n' "$(cat "$HOSTINGER_CI_DIR/id_ed25519.pub")" >> /root/.ssh/authorized_keys
fi

# This key comes from the server console, not an unauthenticated network scan.
printf '%s %s\n' 'kmovement.srv1869569.hstgr.cloud' \
  "$(cut -d ' ' -f 1,2 /etc/ssh/ssh_host_ed25519_key.pub)" > "$HOSTINGER_CI_DIR/known_hosts"

echo 'Prepared a dedicated deployment key. Existing SSH keys were preserved.'
echo 'Server host-key fingerprint (compare before your first SSH connection):'
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
echo 'No private key was printed. Follow docs/operations/hostinger-auto-deploy.md to stream the two files into GitHub Secrets.'
