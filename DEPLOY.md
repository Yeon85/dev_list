# IWNV 서버 배포 (처음: SSH 접속 → 그다음 설치/배포)

## 순서 요약

1. **먼저 SSH로 서버 접속**
2. (필요하면) 서버에서 `/opt/dev_list` 폴더 생성
3. **로컬에서** 코드 보내기 (scp 또는 아래 대안)
4. **SSH 접속한 터미널에서** 배포 명령 실행

---

## 명령어만 복사해서 쓰기

**1) 로컬 PC – SSH 접속 (가장 먼저)**  
(접속 계정은 보통 **root**)

```powershell
ssh root@IWNV서버IP
```

**Windows에서 `ssh`가 인식되지 않을 때**  
PowerShell은 **현재 폴더를 PATH에 안 넣기 때문에**, 두 가지 방법 중 하나로 실행하면 됩니다.

- **방법 A** – 아무 위치에서 **전체 경로**로 실행 (앞에 `&` 필수):
  ```powershell
  & "C:\Windows\System32\OpenSSH\ssh.exe" root@IWNV서버IP
  ```
  (Git만 있으면: `& "C:\Program Files\Git\usr\bin\ssh.exe" root@...`)

- **방법 B** – **OpenSSH 폴더로 이동**한 뒤, **현재 폴더의 실행파일**이므로 앞에 `.\` 를 붙여서 실행:
  ```powershell
  cd C:\Windows\System32\OpenSSH
  .\ssh.exe root@IWNV서버IP
  ```
  (`ssh.exe`만 쓰면 안 되고, **`.\ssh.exe`** 처럼 `.\` 를 꼭 붙여야 함. scp도 `.\scp.exe`)

**2) 서버에 접속한 뒤 – 폴더 준비 (최초 1회)**

```bash
sudo mkdir -p /opt/dev_list
sudo chown $USER:$USER /opt/dev_list
exit
```

**3) 로컬 PC – 코드 보내기**

Windows에 `scp`가 있으면:

```powershell
scp -r C:\dev_list\* root@IWNV서버IP:/opt/dev_list/
```

`scp`가 없으면 (PowerShell에서): **WSL** 사용 또는 **Git**으로 서버에 올린 뒤 서버에서 `git pull`.

```powershell
# WSL 쓰는 경우 (WSL 설치돼 있을 때)
wsl scp -r /mnt/c/dev_list/* root@IWNV서버IP:/opt/dev_list/
```

**4) 다시 SSH 접속 → 배포 실행**

```powershell
ssh root@IWNV서버IP
```

```bash
cd /opt/dev_list
docker compose up -d --build
```

예시: **root**로 접속, 서버 IP가 `123.123.123.123` 이면  
- 1번: `ssh root@123.123.123.123`  
- 2번: `sudo mkdir -p /opt/dev_list` → `exit`  
- 3번: (로컬) `scp -r C:\dev_list\* root@123.123.123.123:/opt/dev_list/` 또는 `wsl scp ...`  
- 4번: 다시 `ssh root@123.123.123.123` → `cd /opt/dev_list` → `docker compose up -d --build`

---

## 흐름 요약

1. **먼저 SSH** 로 IWNV 서버 접속
2. (최초 1회) 서버에서 `/opt/dev_list` 폴더 생성 후 `exit`
3. **로컬**에서 코드 복사 (scp 또는 WSL scp)
4. 다시 **SSH 접속** → 그 터미널에서 배포 명령 실행

---

## 1단계: SSH로 IWNV 접속 (가장 먼저)

접속 계정은 **root** (우분투 계정 아님).

```powershell
ssh root@IWNV서버IP
```

**`ssh`가 안 먹히는 PC (PATH에 없음)**  
PowerShell에서는 현재 폴더도 PATH에 안 들어가므로:

- **전체 경로**로 실행: `& "C:\Windows\System32\OpenSSH\ssh.exe" root@IWNV서버IP`
- 또는 **OpenSSH 폴더로 이동** 후 **`.\ssh.exe`** 로 실행 (현재 폴더 실행은 `.\` 필수):
  ```powershell
  cd C:\Windows\System32\OpenSSH
  .\ssh.exe root@IWNV서버IP
  ```

접속하면 **서버 쉘**로 들어감 (프롬프트가 `root@서버:~#` 같은 식으로 바뀜).

**`Permission denied, please try again` 나올 때**
- **비밀번호** 다시 확인 (대소문자, Caps Lock, 복사 시 앞뒤 공백 주의).
- 서버에서 **root 로그인을 막아 둔 경우**가 있음. 그럴 때는 **다른 계정**(예: `ubuntu`)으로 접속한 뒤, 서버 안에서 `sudo -i` 또는 `sudo su` 로 root 전환:
  ```powershell
  .\ssh.exe ubuntu@IWNV서버IP
  ```
  접속 후: `sudo mkdir -p /opt/dev_list` 등으로 진행하면 됨. (배포 절차는 동일, 앞만 `ubuntu`로 접속)

---

## 2단계: 서버에서 폴더 준비 (최초 1회)

접속한 **서버 터미널**에서:

```bash
sudo mkdir -p /opt/dev_list
sudo chown $USER:$USER /opt/dev_list
exit
```

이후 로컬에서 코드 보낼 때 `/opt/dev_list`가 있어야 함.

---

## 3단계: 로컬에서 IWNV로 코드 보내기

**PowerShell(로컬)** 에서 실행 (서버 IP만 바꾸면 됨, 계정은 **root**).

`scp`가 있으면:

```powershell
scp -r C:\dev_list\* root@IWNV서버IP:/opt/dev_list/
```

Windows에서 `scp`가 없다고 나오면:

- **전체 경로**로 실행:  
  `& "C:\Windows\System32\OpenSSH\scp.exe" -r C:\dev_list\* root@IWNV서버IP:/opt/dev_list/`
- 또는 **OpenSSH 폴더로 이동**한 뒤 **`.\scp.exe`** 로 실행 (앞에 `.\` 필수):
  ```powershell
  cd C:\Windows\System32\OpenSSH
  .\scp.exe -r C:\dev_list\* root@IWNV서버IP:/opt/dev_list/
  ```
- 또는 **WSL** 사용: `wsl scp -r /mnt/c/dev_list/* root@IWNV서버IP:/opt/dev_list/`

(OpenSSH가 아예 없으면: 설정 → 앱 → 선택적 기능 → OpenSSH 클라이언트 설치)

---

## 4단계: 다시 SSH 접속 후 배포 실행

아래는 **전부 IWNV 서버에 SSH 접속한 뒤** 그 터미널에서 입력하는 명령어입니다.

### Docker 있을 때 (권장)

```bash
cd /opt/dev_list
docker compose up -d --build
```

끝. 접속 주소: **http://IWNV서버IP:3000**

### Docker 없을 때 (Node만)

```bash
cd /opt/dev_list
npm install --production
```

`.env` 만들기 (nano 또는 vi):

```bash
echo 'PORT=3000
DATABASE_URL=mysql://유저:비번@localhost:3306/DB이름
SESSION_SECRET=아무랜덤문자' > .env
```

실행:

```bash
node server.js
```

백그라운드로 켜두려면:

```bash
nohup node server.js &
```

또는 pm2:

```bash
npm install -g pm2
pm2 start server.js --name dev_list
pm2 save && pm2 startup
```

---

## 서비스 계속 켜두기 (부팅 시 자동 실행)

서버를 재부팅해도 **http://서버IP:3000** 이 자동으로 떠 있게 하려면 systemd 서비스를 등록합니다.

**서버에 SSH 접속한 뒤** 한 번만 실행:

```bash
# 1) 서비스 파일 복사
sudo cp /opt/dev_list/scripts/dev_list.service /etc/systemd/system/

# 2) systemd 다시 읽기
sudo systemctl daemon-reload

# 3) 부팅 시 자동 시작 설정
sudo systemctl enable dev_list

# 4) 지금 바로 실행 (이미 docker compose 로 띄운 적 있으면 한 번 더 해도 됨)
sudo systemctl start dev_list
```

이후 서버를 재부팅하면 Docker가 켜진 뒤 자동으로 `docker compose up -d`가 실행되어 앱이 뜹니다.  
컨테이너가 죽어도 `restart: unless-stopped` 때문에 Docker가 다시 띄웁니다.

---

## 접속이 안 될 때 (죽었을 때)

**http://서버IP:3000** 이 안 뜨면 서버에 SSH 접속해서 아래 순서로 확인하세요.

1. **컨테이너가 떠 있는지**
   ```bash
   cd /opt/dev_list
   docker compose ps
   ```
   - `Up` 이 아니면: `docker compose up -d` 로 다시 띄우기.

2. **앱 로그 확인 (에러 원인 보기)**
   ```bash
   docker compose logs app --tail 100
   ```

3. **부팅 시 자동 실행을 넣었는데 재부팅 후 안 뜨는 경우**
   ```bash
   sudo systemctl status dev_list
   sudo systemctl start dev_list
   ```

4. **Docker 자체가 꺼져 있는 경우**
   ```bash
   sudo systemctl start docker
   cd /opt/dev_list && docker compose up -d
   ```

---

## 정리

| 순서 | 하는 곳        | 할 일 |
|------|----------------|--------|
| 1 | **로컬 PC**    | `ssh root@서버IP` 로 접속 |
| 2 | **SSH(IWNV)** | (최초) `sudo mkdir -p /opt/dev_list` → `exit` |
| 3 | **로컬 PC**    | `scp -r ...` 또는 `wsl scp ...` 로 코드 복사 |
| 4 | **SSH(IWNV)** | `cd /opt/dev_list` → `docker compose up -d --build` (또는 Node 명령어) |

이후에는 **SSH 접속해서 명령어 넣는 방식**으로만 배포/재시작하면 됩니다.
