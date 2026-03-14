#!/bin/bash
# 자체 서명 SSL 인증서 생성 (HTTPS용). 서버에서 1회 실행.
# 사용법: 프로젝트 루트에서 ./scripts/gen-selfsigned-cert.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$ROOT_DIR/nginx/ssl"
mkdir -p "$SSL_DIR"
if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ]; then
  echo "이미 인증서가 있습니다: $SSL_DIR"
  echo "다시 만들려면 기존 cert.pem, key.pem 을 삭제한 뒤 실행하세요."
  exit 0
fi
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" \
  -subj "/CN=dev_list/O=dev_list"
echo "생성 완료: $SSL_DIR/cert.pem, $SSL_DIR/key.pem"
echo "nginx 재시작: docker compose restart nginx"
