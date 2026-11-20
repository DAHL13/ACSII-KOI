#!/usr/bin/env python3
"""Packages the MV3 extension into dist/ using strict POSIX archive paths."""

from __future__ import annotations

import argparse
import json
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


def validate_manifest_and_locales() -> dict:
    manifest_path = ROOT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

    if manifest.get('manifest_version') != 3:
        raise ValueError('manifest_version must be 3')
    if not manifest.get('version'):
        raise ValueError('manifest.json missing version')
    if not manifest.get('default_locale'):
        raise ValueError('manifest.json missing default_locale')

    for loc in ('es', 'en'):
        msg_path = ROOT / '_locales' / loc / 'messages.json'
        if not msg_path.is_file():
            raise FileNotFoundError(f'Missing locale file: {msg_path}')
        messages = json.loads(msg_path.read_text(encoding='utf-8'))
        for required_key in ('extName', 'extDescription'):
            if required_key not in messages or not messages[required_key].get('message'):
                raise ValueError(f'{msg_path} missing {required_key}')

    return manifest


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


def build_zip(out_path: Path, files: list[tuple[Path, str]]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for src_path, arcname in files:
            if '\\' in arcname:
                raise ValueError(f'Non-POSIX separator in archive entry: {arcname}')
            zf.write(src_path, arcname)


def verify_zip(zip_path: Path) -> int:
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

        for required in ('manifest.json', 'index.html', 'boot.js', 'src/main.js', '_locales/es/messages.json', '_locales/en/messages.json'):
            if required not in names:
                raise ValueError(f'Required entry missing from zip: {required}')

        return len(names)


def main() -> int:
    parser = argparse.ArgumentParser(description='Package ASCII Koi Pond MV3 extension.')
    parser.add_argument('--check', action='store_true', help='Validate bundle in a temporary archive without writing dist/')
    args = parser.parse_args()

    manifest = validate_manifest_and_locales()
    files = collect_extension_files()
    version = manifest['version']

    if args.check:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_zip = Path(tmp_dir) / f'ascii-koi-pond-v{version}.zip'
            build_zip(tmp_zip, files)
            count = verify_zip(tmp_zip)
            print(f'CHECK OK: {count} POSIX entries validated for v{version}')
        return 0

    out_zip = ROOT / 'dist' / f'ascii-koi-pond-v{version}.zip'
    build_zip(out_zip, files)
    count = verify_zip(out_zip)
    print(f'PACKAGED OK: {out_zip.relative_to(ROOT).as_posix()} ({count} POSIX entries, {out_zip.stat().st_size} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
