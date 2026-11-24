#!/usr/bin/env python3
"""Packages the MV3 extension into dist/ for Chromium/Edge and Firefox using POSIX archive paths."""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

INCLUDED_FILES = (
    'manifest.json',
    'index.html',
    'boot.js',
    'LICENSE',
    'PRIVACY.md',
)

INCLUDED_DIRS = (
    'src',
    'styles',
    '_locales',
    'icons',
)

FORBIDDEN_PREFIXES = (
    'docs/',
    'tests/',
    'scripts/',
    'dist/',
    '.git',
    '.github/',
    'AUDITORIA.md',
    'README.md',
)


def parse_i18n_keys(i18n_src: str, lang: str) -> set[str]:
    m = re.search(rf'\b{lang}:\s*\{{(.*?)\n  \}}', i18n_src, re.S)
    if not m:
        raise ValueError(f'Missing {lang} fallback block in src/core/i18n.js')
    keys: set[str] = set()
    for line in m.group(1).splitlines():
        line = line.strip().rstrip(',')
        if not line:
            continue
        km = re.match(r"^([A-Za-z0-9_]+):\s*'(.*)'$", line)
        if not km:
            raise ValueError(f'Unparsed entry in src/core/i18n.js ({lang}): {line}')
        keys.add(km.group(1))
    return keys


def parse_html_i18n_keys(html_text: str) -> set[str]:
    pattern = re.compile(r'\bdata-i18n(?:-(?:title|aria-label|placeholder))?="([^"]+)"')
    return set(pattern.findall(html_text))


def validate_manifest_and_locales() -> dict:
    manifest_path = ROOT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

    if manifest.get('manifest_version') != 3:
        raise ValueError('manifest_version must be 3')
    if not manifest.get('version'):
        raise ValueError('manifest.json missing version')
    if not manifest.get('default_locale'):
        raise ValueError('manifest.json missing default_locale')

    i18n_src = (ROOT / 'src' / 'core' / 'i18n.js').read_text(encoding='utf-8')
    es_js_keys = parse_i18n_keys(i18n_src, 'es')
    en_js_keys = parse_i18n_keys(i18n_src, 'en')
    if es_js_keys != en_js_keys:
        diff = sorted(es_js_keys ^ en_js_keys)
        raise ValueError(f'i18n.js key mismatch between es and en: {diff}')

    html_keys = parse_html_i18n_keys((ROOT / 'index.html').read_text(encoding='utf-8'))
    missing_html = sorted(html_keys - es_js_keys)
    if missing_html:
        raise ValueError(f'index.html references missing i18n keys: {missing_html}')

    js_key_pattern = re.compile(r"\bt\(\s*(['\"])([A-Za-z0-9_]+)\1")
    used_js_keys: set[str] = set()
    for js_path in sorted((ROOT / 'src').rglob('*.js')):
        used_js_keys.update(match[1] for match in js_key_pattern.findall(js_path.read_text(encoding='utf-8')))
    missing_js = sorted(used_js_keys - es_js_keys)
    if missing_js:
        raise ValueError(f'src/ references missing i18n keys: {missing_js}')

    expected_locale_keys = es_js_keys | {'extName', 'extDescription'}
    for loc in ('es', 'en'):
        msg_path = ROOT / '_locales' / loc / 'messages.json'
        if not msg_path.is_file():
            raise FileNotFoundError(f'Missing locale file: {msg_path}')
        messages = json.loads(msg_path.read_text(encoding='utf-8'))
        locale_keys = set(messages.keys())
        if locale_keys != expected_locale_keys:
            missing = sorted(expected_locale_keys - locale_keys)
            extra = sorted(locale_keys - expected_locale_keys)
            raise ValueError(f'{msg_path} parity mismatch (missing={missing}, extra={extra})')
        for required_key in ('extName', 'extDescription'):
            if not messages[required_key].get('message'):
                raise ValueError(f'{msg_path} empty message for {required_key}')

    return manifest


def build_firefox_manifest(chrome_manifest: dict) -> dict:
    ff = json.loads(json.dumps(chrome_manifest))
    ff.pop('minimum_chrome_version', None)
    ff['permissions'] = [p for p in ff.get('permissions', []) if p != 'favicon']
    ff['browser_specific_settings'] = {
        'gecko': {
            'id': 'ascii-koi-pond@dahl13.github.io',
            'strict_min_version': '115.0',
        }
    }
    return ff


def collect_extension_files() -> list[tuple[Path, str]]:
    files: list[tuple[Path, str]] = []

    for rel in INCLUDED_FILES:
        path = ROOT / rel
        if not path.is_file():
            raise FileNotFoundError(f'Missing required file: {rel}')
        files.append((path, rel))

    for dir_name in INCLUDED_DIRS:
        dir_path = ROOT / dir_name
        if not dir_path.is_dir():
            raise FileNotFoundError(f'Missing required directory: {dir_name}')
        for item in sorted(dir_path.rglob('*')):
            if item.is_file():
                arcname = item.relative_to(ROOT).as_posix()
                files.append((item, arcname))

    return files


def build_zip(out_path: Path, files: list[tuple[Path, str]], manifest_override: str | None = None) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for src_path, arcname in files:
            if '\\' in arcname:
                raise ValueError(f'Non-POSIX separator in archive entry: {arcname}')
            if arcname == 'manifest.json' and manifest_override is not None:
                zf.writestr('manifest.json', manifest_override)
            else:
                zf.write(src_path, arcname)


def verify_zip(zip_path: Path, target: str) -> int:
    with zipfile.ZipFile(zip_path, 'r') as zf:
        bad = zf.testzip()
        if bad is not None:
            raise ValueError(f'Corrupt zip entry: {bad}')
        names = zf.namelist()
        if not names:
            raise ValueError('Archive is empty')

        for name in names:
            if '\\' in name:
                raise ValueError(f'Archive entry contains backslash: {name}')
            if any(name == p or name.startswith(p) for p in FORBIDDEN_PREFIXES) or name.endswith('.zip'):
                raise ValueError(f'Forbidden file included in package: {name}')

        for required in (
            'manifest.json',
            'index.html',
            'boot.js',
            'src/main.js',
            '_locales/es/messages.json',
            '_locales/en/messages.json',
        ):
            if required not in names:
                raise ValueError(f'Required entry missing from zip: {required}')

        manifest_data = json.loads(zf.read('manifest.json').decode('utf-8'))
        if target == 'firefox':
            if 'favicon' in manifest_data.get('permissions', []):
                raise ValueError('Firefox manifest must not declare unsupported favicon permission')
            if 'minimum_chrome_version' in manifest_data:
                raise ValueError('Firefox manifest must not declare minimum_chrome_version')
            if not manifest_data.get('browser_specific_settings', {}).get('gecko', {}).get('id'):
                raise ValueError('Firefox manifest missing gecko.id')
        else:
            if not manifest_data.get('minimum_chrome_version'):
                raise ValueError('Chrome manifest missing minimum_chrome_version')

        return len(names)


def package_target(files: list[tuple[Path, str]], manifest: dict, target: str, out_dir: Path, is_check: bool) -> None:
    version = manifest['version']
    if target == 'firefox':
        zip_name = f'ascii-koi-pond-firefox-v{version}.zip'
        manifest_text = json.dumps(build_firefox_manifest(manifest), ensure_ascii=False, indent=2) + '\n'
    else:
        zip_name = f'ascii-koi-pond-v{version}.zip'
        manifest_text = None

    out_zip = out_dir / zip_name
    build_zip(out_zip, files, manifest_override=manifest_text)
    count = verify_zip(out_zip, target)
    if is_check:
        print(f'CHECK OK ({target}): {count} POSIX entries validated for v{version}')
    else:
        rel_out = out_zip.relative_to(ROOT).as_posix()
        print(f'PACKAGED OK ({target}): {rel_out} ({count} POSIX entries, {out_zip.stat().st_size} bytes)')


def main() -> int:
    parser = argparse.ArgumentParser(description='Package ASCII Koi Pond MV3 extension.')
    parser.add_argument('--check', action='store_true', help='Validate bundles & i18n parity without writing dist/')
    parser.add_argument(
        '--target',
        choices=('chrome', 'firefox', 'all'),
        default='chrome',
        help='Target browser package (default: chrome; --check always validates both)',
    )
    args = parser.parse_args()

    manifest = validate_manifest_and_locales()
    files = collect_extension_files()
    targets = ('chrome', 'firefox') if (args.check or args.target == 'all') else (args.target,)

    if args.check:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            for tgt in targets:
                package_target(files, manifest, tgt, tmp_path, is_check=True)
        return 0

    out_dir = ROOT / 'dist'
    for tgt in targets:
        package_target(files, manifest, tgt, out_dir, is_check=False)
    return 0


if __name__ == '__main__':
    sys.exit(main())
