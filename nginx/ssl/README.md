# SSL 인증서 (HTTPS)

이 폴더에 **cert.pem**, **key.pem** 이 있어야 nginx가 443 HTTPS로 동작합니다.

## 인증서가 없을 때 (최초 1회)

프로젝트 루트에서:

```bash
chmod +x scripts/gen-selfsigned-cert.sh
./scripts/gen-selfsigned-cert.sh
```

또는 (Windows에서 WSL/Git Bash):

```bash
bash scripts/gen-selfsigned-cert.sh
```

위 스크립트가 `nginx/ssl/cert.pem`, `nginx/ssl/key.pem` (자체 서명 인증서)를 생성합니다.

- **Docker 사용 시**: `docker compose up -d` 전에 한 번 실행해 두면 됩니다.
- **실서비스**에서는 Let's Encrypt 등으로 발급한 인증서로 교체하면 됩니다.
