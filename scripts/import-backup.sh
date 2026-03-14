#!/bin/bash
# 서버에서 실행: 옛 DB 덤프 파일을 Docker MySQL(devlist)에 넣기
# 사용법: ./scripts/import-backup.sh backup.sql
set -e
BACKUP="$1"
if [ -z "$BACKUP" ] || [ ! -f "$BACKUP" ]; then
  echo "사용법: $0 <덤프파일경로>"
  echo "예: $0 ./backup.sql"
  exit 1
fi
echo "기존 devlist DB 비우고 임포트합니다..."
docker exec -i iwinv-db mysql -uroot -proot -e "DROP DATABASE IF EXISTS devlist; CREATE DATABASE devlist; GRANT ALL ON devlist.* TO 'devlist'@'%'; FLUSH PRIVILEGES;"
# 덤프에 dev_list 로 되어 있으면 devlist 로 바꿔서 넣기
sed 's/`dev_list`/`devlist`/g;s/dev_list\./devlist./g' "$BACKUP" | \
  docker exec -i iwinv-db mysql -udevlist -pdevlist_pw devlist
echo "임포트 완료: $BACKUP -> devlist"
