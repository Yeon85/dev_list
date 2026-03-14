# 옛 DB 데이터 → 서버 Docker MySQL 넣기

## 1단계: 옛 DB에서 덤프 뜨기 (로컬 PC)

옛 DB 주소가 `.env`의 Railway 주소라면, **로컬**에서 아래 실행.

**MySQL 클라이언트 필요** (없으면 설치: `choco install mysql` 또는 Git Bash에 포함된 것 사용)

```bash
cd C:\dev_list

# 옛 DB 덤프 (비밀번호는 .env 에서 확인)
mysqldump -h nozomi.proxy.rlwy.net -P 10904 -u root -p dev_list --no-create-db --routines --triggers > backup.sql
# 비밀번호 입력: .env 의 DATABASE_URL 에 있는 비번
```

또는 한 줄로 (비번 직접 넣지 말고, 프롬프트에서 입력 권장):

```powershell
mysqldump -h nozomi.proxy.rlwy.net -P 10904 -u root -p dev_list --no-create-db > backup.sql
```

`backup.sql` 이 생기면 다음 단계로.

---

## 2단계: 서버로 파일 복사

```powershell
scp C:\dev_list\backup.sql root@서버IP:/opt/dev_list/
```

(PATH에 scp 없으면: `cd C:\Windows\System32\OpenSSH` 후 `.\scp.exe ...`)

---

## 3단계: 서버에서 Docker MySQL 로 임포트

SSH 로 서버 접속한 뒤:

```bash
cd /opt/dev_list
chmod +x scripts/import-backup.sh
./scripts/import-backup.sh backup.sql
```

비밀번호 묻지 않음 (스크립트가 devlist_pw 사용).  
끝나면 앱에서 기존 회원/프로젝트/카테고리로 로그인·조회 가능.

---

## 요약

| 단계 | 어디서 | 할 일 |
|------|--------|--------|
| 1 | 로컬 | `mysqldump` 로 옛 DB → `backup.sql` |
| 2 | 로컬 | `scp backup.sql root@서버:/opt/dev_list/` |
| 3 | 서버 | `cd /opt/dev_list` → `./scripts/import-backup.sh backup.sql` |
