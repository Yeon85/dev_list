#!/bin/bash
# IWNV 서버에서 실행하는 배포 스크립트
set -e
cd "$(dirname "$0")"

echo "=== dev_list 배포 ==="
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  echo "Docker Compose로 실행..."
  docker compose up -d --build
  echo "완료. http://$(hostname -I | awk '{print $1}'):3000"
else
  echo "Docker 없음. Node로 실행하려면: npm install && node server.js"
  echo ".env 에 DATABASE_URL, SESSION_SECRET 설정 필요."
fi
