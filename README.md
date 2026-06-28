# 맞팔체커

Instagram 데이터 ZIP을 브라우저에서만 분석해 맞팔, 취소 검토 계정과 팔로워만 있는 계정을 확인하는 로컬 분석 웹앱입니다.

- 서비스: https://unfollow.lavalabs.co.kr
- 운영: Lava Labs
- 로그인·비밀번호 입력 없음
- ZIP 및 분석 결과 서버 전송 없음
- 자동 언팔 기능 없음

## v13 주요 기능

- 단일 ZIP의 맞팔·취소 검토·팔로워 전용 계정 분석
- 이전 ZIP과 최신 ZIP의 관계 변화 비교
- 새 팔로워, 팔로워 이탈, 새 팔로잉, 팔로잉 종료, 새 맞팔, 맞팔 종료 분류
- 변화 목록 복사 및 CSV 저장
- 관계 데이터의 비식별 해시 스케치로 작업공간 연결
- 작업공간 이름 변경, 개별 백업, 삭제, 전체 백업
- 사용자 아이디와 파일명을 포함하지 않는 안전 진단 리포트
- 모바일·다크모드·키보드 접근성 및 오프라인 사용 지원

## 배포 구조

`main` 브랜치에 커밋하면 GitHub Actions가 압축된 기존 원본을 복원한 뒤 v12 안정화와 v13 기능을 적용하고, 브라우저 회귀 테스트를 통과한 정적 사이트만 GitHub Pages로 배포합니다.

```text
v9/part*.txt
   ↓ scripts/build-release.mjs
   ↓ scripts/build-v13.mjs
 dist/index.html + assets + SEO/PWA files
   ↓ Playwright 회귀 테스트
   ↓ GitHub Pages
 https://unfollow.lavalabs.co.kr
```

## 주요 파일

- `scripts/build-pages.mjs`: 기존 원본 복원 및 v12 안전 패치
- `scripts/build-release.mjs`: CSP·외부 의존성 정리와 최종 정적 빌드
- `scripts/build-v13.mjs`: 비식별 내용 기반 작업공간 연결
- `assets/v13-features.js`: 두 시점 비교, 작업공간 관리, 진단 리포트
- `assets/v13-features.css`: v13 데스크톱·모바일·다크모드 UI
- `scripts/deploy-smoke.mjs`: 기존 기능 회귀 테스트
- `scripts/v13-smoke.mjs`: v13 비교·작업공간·진단 기능 테스트
- `manifest.webmanifest`, `sw.js`: 설치형 웹앱과 오프라인 캐시
- `robots.txt`, `sitemap.xml`: 검색 엔진 기본 설정

## 개인정보 안내

선택한 ZIP 파일과 분석 결과는 외부 서버로 전송되지 않습니다. 작업 상태와 설정은 사용자의 브라우저 로컬 저장소에 보관됩니다. 작업공간 연결에는 사용자 아이디 원문 대신 브라우저에서 계산한 숫자 해시 스케치만 저장됩니다. 맞팔체커는 Instagram 또는 Meta와 제휴하거나 공식적으로 운영되는 서비스가 아닙니다.
