# 남상욱 교수 홈페이지

https://ai-future-planner.netlify.app

## 구조
- `index.html` 홈 (블로그 카드는 빌드 때 `<!-- BLOG:START -->`~`<!-- BLOG:END -->` 사이에 최신 3개가 자동으로 들어갑니다)
- `blog/*.html` 완성된 블로그 글 (예: cafe-dashboard.html)
- `posts/*.html` 새 블로그 글 원고. 맨 위 `<!--meta {...} -->` 주석 + 본문 조각. 빌드가 `blog/<slug>.html` 로 만들어 줍니다.
- `newsletter/index.html` 뉴스레터 페이지. `newsletter/issues/YYYY-MM-DD.json` 을 GitHub에서 바로 읽어 보여 줍니다(재배포 불필요).
- `build.js` 빌드 스크립트 (블로그 목록, sitemap.xml, llms.txt 생성) → `_site/`

## 배포 규칙 (Netlify 무료 크레딧 절약)
- 커밋 메시지에 `[deploy]` 가 있을 때만 Netlify가 배포합니다 (배포 1회 = 15 크레딧, 무료 300 크레딧/월).
- 뉴스레터: 매일 08:00, `[deploy]` 없이 커밋 (크레딧 0).
- 블로그: 매주 월요일 08:00 / 13:00 / 17:00 에 글 1개씩, 17:00 커밋에만 `[deploy]`.

## posts 원고 형식
```html
<!--meta
{"title":"제목","date":"2026-11-02","slug":"ai-career-weekly-1","category":"AI·진로 인사이트","description":"검색 결과에 보일 한두 문장 요약"}
-->
<p class="lead">부제</p>
<p>본문...</p>
<h2>소제목</h2>
```
