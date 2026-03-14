# Push 거부 (시크릿 감지) 해결 방법

`시작.me` 등에 GitHub 토큰이 들어가 있어 push가 막힌 경우, **둘 중 하나**만 하면 됩니다.

---

## 방법 1: GitHub에서 시크릿 허용 후 push (가장 빠름)

1. **아래 링크**에서 해당 시크릿 **Allow** 처리  
   https://github.com/Yeon85/dev_list/security/secret-scanning/unblock-secret/3AvSkjxr7iu8LItY01OJKN3exsT

2. **GitHub에서 해당 토큰 반드시 폐기**  
   (한 번 노출된 토큰은 재사용 금지)  
   Settings → Developer settings → Personal access tokens → 해당 토큰 삭제

3. 로컬에서 커밋 후 push:
   ```bash
   git add .gitignore
   git rm --cached 시작.me
   git commit -m "chore: 시작.me 비추적, gitignore 추가"
   git push
   ```

---

## 방법 2: 히스토리에서 시크릿 제거 후 push

(Git Bash에서 실행 권장)

```bash
cd /c/dev_list
# 문제 커밋(673178a) 이전부터 rebase, 해당 커밋을 edit
git rebase -i 673178a^

# 에디터에서 673178a 커밋 줄의 "pick" 을 "edit" 로 바꾼 뒤 저장

# rebase가 멈추면, 시작.me 에서 토큰 줄 삭제 후
git add 시작.me
git commit --amend --no-edit
git rebase --continue

# 끝나면
git push --force-with-lease
```

이후 **GitHub에서 해당 토큰은 폐기**하는 것이 좋습니다.
