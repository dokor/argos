"""Rebuild a portable preview without application dependencies or persistence."""
from pathlib import Path

root = Path(__file__).resolve().parent
fragment = (root / 'clarte.fragment.html').read_text(encoding='utf-8')
head = '''<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Argos — Clarté, référence de conception</title>
<style>:root{color-scheme:light dark}body{margin:16px;background:light-dark(#eef0f5,#0c111c)}button,a,summary{cursor:pointer}</style>
<script src="https://unpkg.com/lucide@1.17.0/dist/umd/lucide.min.js"></script>
</head><body>
'''
(root / 'clarte.html').write_text(head + fragment + '\n</body></html>\n', encoding='utf-8', newline='\n')
print('Built reference/clarte.html (mock data, no backend)')
