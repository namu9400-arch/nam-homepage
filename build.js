// build.js - 외부 의존성 없는 정적 빌드 스크립트 (Netlify: node build.js)
// 1) posts/*.html (메타 주석 + 본문 조각) -> blog/<slug>.html 완성 페이지로 생성
// 2) blog/index.html 전체 글 목록, 홈 블로그 카드(최신 3개), sitemap.xml, llms.txt 생성
// 3) 결과물은 _site/ 에 출력
const fs = require('fs').promises;
const path = require('path');
const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const SITE = 'https://ai-future-planner.netlify.app';
const SKIP = new Set(['_site', 'node_modules', '.git', 'posts', 'build.js', 'netlify.toml', 'README.md', '.gitignore']);

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dot = d => d.replace(/-/g, '.');

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    if (src === ROOT && SKIP.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d); else await fs.copyFile(s, d);
  }
}

function parseFragment(src, file) {
  const m = src.match(/<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error('meta 주석 없음: ' + file);
  const meta = JSON.parse(m[1]);
  for (const k of ['title', 'date', 'slug', 'description']) if (!meta[k]) throw new Error(k + ' 없음: ' + file);
  if (!/^[a-z0-9-]+$/.test(meta.slug)) throw new Error('slug는 영문 소문자/숫자/하이픈만: ' + file);
  return { ...meta, category: meta.category || '블로그', body: src.replace(m[0], '').trim(), fragment: true };
}

function parseFullPage(src, slug) {
  const pick = re => (src.match(re) || [])[1] || '';
  const label = pick(/<p class="label">([^<]*)<\/p>/);
  return {
    slug,
    title: pick(/<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '').trim(),
    date: pick(/"datePublished"\s*:\s*"([^"]+)"/) || label.split('·')[0].trim().replace(/\./g, '-'),
    description: pick(/<meta name="description" content="([^"]*)"/),
    category: (label.split('·')[1] || '블로그').trim(),
    fragment: false,
  };
}

function nav() {
  return '<nav class="nav" aria-label="이동"><a href="/">홈</a><a href="/blog/">블로그</a><a href="/newsletter/">뉴스레터</a><a href="/#contact">상담 신청</a></nav>';
}

function head({ title, description, url, type = 'article', image = SITE + '/og.png', ld = '' }, styles) {
  return '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
    '<title>' + esc(title) + '</title>\n' +
    '<meta name="description" content="' + esc(description) + '">\n' +
    '<link rel="canonical" href="' + url + '">\n' +
    '<meta property="og:type" content="' + type + '">\n<meta property="og:site_name" content="남상욱 교수">\n<meta property="og:locale" content="ko_KR">\n' +
    '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(description) + '">\n' +
    '<meta property="og:url" content="' + url + '">\n<meta property="og:image" content="' + image + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="' + esc(title) + '">\n' +
    '<meta name="twitter:description" content="' + esc(description) + '">\n<meta name="twitter:image" content="' + image + '">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700&display=swap">\n' +
    ld + styles + '\n</head><body>\n<div class="wrap">\n  <header class="top">\n    <a class="brand" href="/">남상욱 교수</a>\n    ' + nav() + '\n  </header>\n  <main>\n';
}
function foot(date) {
  return '\n  </main>\n  <footer>\n    <p class="label">남상욱 교수 · 한국기술교육대학교 IPP센터 산학협력 교수</p>\n    <p class="label">작성일 ' + dot(date) + '</p>\n  </footer>\n</div>\n</body></html>\n';
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await copyDir(ROOT, OUT);

  const tplSrc = await fs.readFile(path.join(ROOT, 'blog', 'cafe-dashboard.html'), 'utf8');
  const styles = (tplSrc.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');

  const posts = [];
  for (const f of (await fs.readdir(path.join(ROOT, 'blog'))).filter(f => f.endsWith('.html') && f !== 'index.html')) {
    posts.push(parseFullPage(await fs.readFile(path.join(ROOT, 'blog', f), 'utf8'), f.replace(/\.html$/, '')));
  }
  if (await exists(path.join(ROOT, 'posts'))) {
    for (const f of (await fs.readdir(path.join(ROOT, 'posts'))).filter(f => f.endsWith('.html'))) {
      const p = parseFragment(await fs.readFile(path.join(ROOT, 'posts', f), 'utf8'), f);
      if (posts.some(x => x.slug === p.slug)) throw new Error('slug 중복: ' + p.slug);
      p.file = f;
      posts.push(p);
    }
  }
  // 최신순 (같은 날짜면 파일 이름 역순: 0800 < 1300 < 1700)
  posts.sort((a, b) => (b.date + (b.file || '')).localeCompare(a.date + (a.file || '')));

  for (const p of posts.filter(p => p.fragment)) {
    const url = SITE + '/blog/' + p.slug;
    const ld = '<script type="application/ld+json">\n' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description, datePublished: p.date, inLanguage: 'ko', url, author: { '@type': 'Person', name: '남상욱' } }) + '\n</script>\n';
    const html = head({ title: p.title + ' | 남상욱 교수', description: p.description, url, ld }, styles) +
      '<article class="post">\n  <p class="label">' + dot(p.date) + ' · ' + esc(p.category) + '</p>\n  <h1>' + esc(p.title) + '</h1>\n' + p.body +
      '\n</article>\n    <p><a class="back" href="/blog/">← 블로그 목록으로</a></p>' + foot(p.date);
    await fs.writeFile(path.join(OUT, 'blog', p.slug + '.html'), html);
  }

  const listItems = posts.map(p => '  <article class="card"><span class="tag">' + dot(p.date) + ' · ' + esc(p.category) + '</span><h3><a href="/blog/' + p.slug + '">' + esc(p.title) + '</a></h3><p>' + esc(p.description) + '</p></article>').join('\n');
  const listHtml = head({ title: '블로그 | 남상욱 교수', description: '남상욱 교수가 AI, 진로, 산학협력에 대해 배우고 생각한 것을 기록하는 블로그입니다.', url: SITE + '/blog/', type: 'website' }, styles) +
    '<section class="post" style="max-width:1080px"><p class="label">블로그</p><h1>AI를 배우며 기록합니다</h1>\n<div class="cards">\n' + listItems + '\n</div></section>' + foot(posts[0]?.date || '2026-10-24');
  await fs.writeFile(path.join(OUT, 'blog', 'index.html'), listHtml);

  const idxPath = path.join(OUT, 'index.html');
  let idx = await fs.readFile(idxPath, 'utf8');
  const cards = posts.slice(0, 3).map(p => '        <article class="card">\n          <span class="tag">' + dot(p.date) + ' · ' + esc(p.category) + '</span>\n          <h3><a href="/blog/' + p.slug + '">' + esc(p.title) + '</a></h3>\n          <p>' + esc(p.description) + '</p>\n        </article>').join('\n');
  idx = idx.replace(/<!-- BLOG:START -->[\s\S]*?<!-- BLOG:END -->/, '<!-- BLOG:START -->\n' + cards + '\n        <!-- BLOG:END -->');
  await fs.writeFile(idxPath, idx);

  const urls = [{ loc: SITE + '/', d: posts[0]?.date }, { loc: SITE + '/blog/', d: posts[0]?.date }, { loc: SITE + '/newsletter/' }]
    .concat(posts.map(p => ({ loc: SITE + '/blog/' + p.slug, d: p.date })));
  await fs.writeFile(path.join(OUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => '  <url><loc>' + u.loc + '</loc>' + (u.d ? '<lastmod>' + u.d + '</lastmod>' : '') + '</url>').join('\n') + '\n</urlset>\n');

  await fs.writeFile(path.join(OUT, 'llms.txt'), '# 남상욱 교수\n\n> 한국기술교육대학교 IPP센터 산학협력 교수. 대학생·취업준비생의 진로 상담과 컨설팅, IPP 현장실습, AI 기반 진로설계를 돕습니다.\n\n' +
    '## 주요 페이지\n- [홈](' + SITE + '/): 소개, 하는 일, 경력과 저서, 자주 묻는 질문\n- [블로그](' + SITE + '/blog/): AI와 진로에 대한 기록\n- [뉴스레터](' + SITE + '/newsletter/): 매일 아침 8시 AI·진로 브리핑\n\n' +
    '## 블로그 글\n' + posts.map(p => '- [' + p.title + '](' + SITE + '/blog/' + p.slug + '): ' + p.description).join('\n') + '\n');

  console.log('build ok:', posts.length, 'posts');
}
main().catch(e => { console.error(e); process.exit(1); });
