# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec — build on the target OS (Win/Mac/Linux)."""

import sys
from pathlib import Path

block_cipher = None
app_root = Path(SPECPATH).parent  # photobooth-kiosk/

a = Analysis(
    [str(app_root / 'main.py')],
    pathex=[str(app_root)],
    binaries=[],
    datas=[
        (str(app_root / 'assets'), 'assets'),
    ],
    hiddenimports=[
        'customtkinter',
        'PIL',
        'PIL._tkinter_finder',
        'cv2',
        'numpy',
        'qrcode',
        'requests',
        'dotenv',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='BaseballCardKiosk',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='BaseballCardKiosk',
)
