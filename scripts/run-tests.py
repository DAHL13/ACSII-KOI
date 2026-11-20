#!/usr/bin/env python3
"""Runs unit tests, UI integration tests, and index.html smoke checks across locales & viewports."""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CANDIDATE_BINS = (
    os.environ.get('BROWSER_BIN', ''),
    shutil.which('msedge') or '',
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
    shutil.which('chromium-browser') or '',
    shutil.which('microsoft-edge') or '',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
)


def find_browser() -> str:
    for path in CANDIDATE_BINS:
        if path and Path(path).is_file():
            return str(path)
    raise RuntimeError('No Chromium or Microsoft Edge executable found (set BROWSER_BIN env var).')


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def dump_dom(browser: str, url: str, budget_ms: int = 1500, lang: str = 'es-ES', viewport: str = '1280,800') -> str:
    profile = tempfile.mkdtemp(prefix='koi_test_profile_')
    try:
        cmd = [
            browser,
            '--headless=new',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            f'--lang={lang}',
            f'--user-data-dir={profile}',
            f'--window-size={viewport}',
            f'--virtual-time-budget={budget_ms}',
            '--dump-dom',
            url,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90)
        if not res.stdout.strip():
            raise RuntimeError(f'Empty DOM dump for {url}. stderr:\n{res.stderr}')
        return res.stdout
    finally:
        shutil.rmtree(profile, ignore_errors=True)


def run_test_suite(
    browser: str,
    base_url: str,
    route: str,
    label: str,
    budget_ms: int = 1500,
    lang: str = 'es-ES',
    viewport: str = '1280,800',
) -> tuple[int, int]:
    dom = dump_dom(browser, f'{base_url}{route}', budget_ms=budget_ms, lang=lang, viewport=viewport)
    m_status = re.search(r'<div[^>]*id="test-report"[^>]*>', dom)
    if not m_status:
        raise RuntimeError(f'{label}: #test-report not found in DOM')
    tag = m_status.group(0)
    status = re.search(r'data-status="([^"]+)"', tag)
    passed = re.search(r'data-pass="(\d+)"', tag)
    failed = re.search(r'data-fail="(\d+)"', tag)

    if not status or status.group(1) != 'done':
        raise RuntimeError(f'{label}: test suite did not finish (tag={tag})')

    p_count = int(passed.group(1)) if passed else 0
    f_count = int(failed.group(1)) if failed else 1

    print(f'\n=== {label} (PASS={p_count}, FAIL={f_count}) ===')
    log_m = re.search(r'<ul[^>]*id="test-log"[^>]*>(.*?)</ul>', dom, re.S)
    log_html = log_m.group(1) if log_m else ''
    for li_match in re.finditer(r'<li\b[^>]*>(.*?)</li>', log_html, re.S):
        print(' ', unescape(li_match.group(1)))

    if p_count == 0 or f_count > 0:
        return p_count, max(1, f_count)
    return p_count, 0


def run_index_smoke(
    browser: str,
    base_url: str,
    expected_lang: str = 'es',
    cli_lang: str = 'es-ES',
    viewport: str = '1280,800',
    query: str = '',
) -> bool:
    for budget_ms in (1000, 1800):
        dom = dump_dom(browser, f'{base_url}/index.html{query}', budget_ms=budget_ms, lang=cli_lang, viewport=viewport)
        html_lang_m = re.search(r'<html[^>]*\blang="([^"]+)"', dom)
        clock_m = re.search(r'<time[^>]*id="clock"[^>]*>(.*?)</time>', dom, re.S)
        greet_m = re.search(r'<h1[^>]*id="greeting"[^>]*>(.*?)</h1>', dom, re.S)
        stones = re.findall(r'class="river-stone"', dom)

        lang_ok = bool(html_lang_m and html_lang_m.group(1).lower().startswith(expected_lang))
        clock_ok = bool(clock_m and clock_m.group(1).strip())
        greet_ok = bool(greet_m and greet_m.group(1).strip())
        stones_ok = len(stones) == 6
        no_dead_id = 'id="lilies-btn"' not in dom and 'class="control-label"' not in dom
        if clock_ok or budget_ms == 1800:
            break

    print(
        f'\n=== /index.html smoke ({expected_lang} @ {viewport}) ===\n'
        f'  lang={html_lang_m.group(1) if html_lang_m else None!r} ok={lang_ok}\n'
        f'  clock={clock_m.group(1).strip() if clock_m else None!r} ok={clock_ok}\n'
        f'  greeting={greet_m.group(1).strip() if greet_m else None!r} ok={greet_ok}\n'
        f'  riverStones={len(stones)} ok={stones_ok}\n'
        f'  deadDomClean={no_dead_id}'
    )
    return lang_ok and clock_ok and greet_ok and stones_ok and no_dead_id


def main() -> int:
    parser = argparse.ArgumentParser(description='Run ASCII Koi Pond headless test matrix.')
    parser.add_argument('--single', action='store_true', help='Run only primary es-ES 1280x800 pass')
    args = parser.parse_args()

    browser = find_browser()
    print(f'Browser: {browser}')

    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    base_url = f'http://127.0.0.1:{port}'
    total_pass = 0
    total_fail = 0
    smoke_failures = 0

    try:
        u_pass, u_fail = run_test_suite(browser, base_url, '/tests/unit.html', 'Unit Tests', budget_ms=1500)
        total_pass += u_pass
        total_fail += u_fail

        matrix = [
            ('es', 'es-ES', '1280,800', ''),
        ]
        if not args.single:
            matrix.extend([
                ('en', 'en-US', '1280,800', '?lang=en'),
                ('es', 'es-ES', '800,600', ''),
            ])

        for expected_lang, cli_lang, viewport, query in matrix:
            ui_pass, ui_fail = run_test_suite(
                browser,
                base_url,
                f'/tests/ui.html{query}',
                f'UI Integration Tests ({expected_lang} @ {viewport})',
                budget_ms=2500,
                lang=cli_lang,
                viewport=viewport,
            )
            total_pass += ui_pass
            total_fail += ui_fail

            if not run_index_smoke(
                browser,
                base_url,
                expected_lang=expected_lang,
                cli_lang=cli_lang,
                viewport=viewport,
                query=query,
            ):
                smoke_failures += 1
    finally:
        server.shutdown()
        server.server_close()

    total_fail += smoke_failures
    print(f'\nTOTAL: {total_pass} passed, {total_fail} failed (smoke_failures={smoke_failures})')
    return 0 if total_fail == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
