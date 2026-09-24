"""index.html + css/js/data + game.html → dist/학습앱.html (오프라인용 단일 파일)
먼저 tools/check-data.mjs로 데이터를 검사하고, 실패하면 만들지 않는다. 화면에 빌드 시각·커밋을 표시한다."""
import base64, datetime, pathlib, re, subprocess, sys

R = pathlib.Path(__file__).parent
read = lambda p: (R / p).read_text(encoding='utf-8')

if subprocess.run(['node', str(R / 'tools' / 'check-data.mjs')]).returncode:
    sys.exit('데이터 검사 실패 — 빌드하지 않음')

git = lambda *a: subprocess.run(['git', *a], cwd=R, capture_output=True, text=True).stdout.strip()
commit = git('rev-parse', '--short', 'HEAD') + ('+수정중' if git('status', '--porcelain', '--', '.', ':!dist') else '')
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d %H:%M')
VERSION = f"const BUILD={{time:'{now}',commit:'{commit} 오프라인'}};\n"


def fonts(s):
    # fonts/ 폴더에 파일이 있으면 base64로 넣고, 없으면 경로 그대로 둔다
    def sub(m):
        f = R / 'fonts' / m[1]
        return f'url("data:font/woff2;base64,{base64.b64encode(f.read_bytes()).decode()}")' if f.exists() else m[0]
    return re.sub(r'url\("(?:\.\./)?fonts/([^"]+)"\)', sub, s)


js = lambda p: VERSION if p == 'js/version.js' else read(p)
inline_js = lambda s: re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>\n' + js(m[1]) + '</script>', s)

html = read('index.html')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>\n' + fonts(read(m[1])) + '</style>', html)
html = inline_js(html)
html = html.replace('</body>', '<template id="gameTpl">\n' + fonts(inline_js(read('game.html'))) + '</template>\n</body>')

out = R / 'dist' / '학습앱.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out, f'{out.stat().st_size // 1024} KB', '·', now, commit)
