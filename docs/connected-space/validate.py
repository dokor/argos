"""Validate this specification's local links, fixture, issue graph and frozen assets.

This is a documentation check, not an Argos application test.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote

parser = argparse.ArgumentParser()
parser.add_argument('--repo-root', type=Path, help='Optional source repository for sibling documentation links')
args = parser.parse_args()
root = Path(__file__).resolve().parent
repo = args.repo_root.resolve() if args.repo_root else root.parents[1]
errors = []

def check(condition, message):
    if not condition:
        errors.append(message)

for doc in root.rglob('*.md'):
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', doc.read_text(encoding='utf-8')):
        if re.match(r'^[a-z]+:', target) or target.startswith('#'):
            continue
        target = unquote(target.split('#')[0].strip('<>'))
        resolved = (doc.parent / target).resolve()
        if not resolved.exists() and args.repo_root:
            try:
                relative = resolved.relative_to(root.parents[1])
                resolved = repo / relative
            except ValueError:
                pass
        check(resolved.exists(), f'Broken link: {doc.name} -> {target}')

data = json.loads((root / 'fixtures/connected-space.json').read_text(encoding='utf-8'))
rules = {r['ruleKey']:r for r in data['rules']}
pages = [p for d in data['domains'] for p in d['pages']]
def findings(page, severity):
    return sum(outcome == 'FAIL' and rules[key]['severity'] == severity for key,outcome in page['outcomes'].items())
def priority(page):
    return findings(page,'CRITICAL') + findings(page,'IMPORTANT') > 0
def incomplete(page):
    return page['executionStatus'] in ['FAILED','CANCELED'] or page['completeness'] == 'PARTIAL'

expected = data['expected']
check(len({p['url'] for p in pages}) == expected['trackedUrls'], 'Tracked URL total mismatch')
check(sum(map(priority,pages)) == expected['priorityUrls'], 'Priority total mismatch')
check(sum(map(incomplete,pages)) == expected['incompleteUrls'], 'Incomplete total mismatch')
check(sum(p['reportAvailable'] for p in pages) == expected['latestPublishedReports'], 'Published total mismatch')
usage=data['usage']
check(max(0,usage['limit']-usage['used']-usage['reserved']) == usage['expectedAvailable'], 'Usage mismatch')
check(expected['latestPublishedReports'] + usage['historicalPublishedRunsOutsideLatestSelection'] == usage['used'], 'Ledger fixture mismatch')
atelier=data['domains'][0]['pages']
check(len(atelier) == expected['atelier']['selected'], 'Domain selection mismatch')
check(sum(p['completeness']=='FULL' for p in atelier)==expected['atelier']['complete'], 'Complete mismatch')
check(sum(p['completeness']=='PARTIAL' for p in atelier)==expected['atelier']['partial'], 'Partial mismatch')
check(sum(p['executionStatus']=='FAILED' for p in atelier)==expected['atelier']['failed'], 'Failed mismatch')
check(sum(map(priority,atelier)) == expected['atelier']['priority'], 'Domain priority mismatch')
common={}
for key in rules:
    affected=sum(p['outcomes'][key]=='FAIL' for p in atelier)
    evaluated=sum(p['outcomes'][key] in ['PASS','FAIL'] for p in atelier)
    if affected >= 2:
        common[key]={'affected':affected,'evaluated':evaluated}
check(common == expected['atelier']['common'], 'Common findings/denominators mismatch')
ranking=sorted(filter(priority,atelier),key=lambda p:(-findings(p,'CRITICAL'),-findings(p,'IMPORTANT'),p['url']))
check(ranking[0]['url'].endswith(expected['atelier']['firstProblematicPath']), 'Priority order mismatch')

register=json.loads((root/'issues.json').read_text(encoding='utf-8'))
items={i['id']:i for i in register['items']}
check(len(items)==len(register['items']), 'Duplicate work IDs')
check(isinstance(register['epic'],int), 'Epic not published')
numbers=[]
for key,item in items.items():
    check((root/item['body']).is_file(), f'Missing issue body {key}')
    check(isinstance(item['number'],int), f'Issue not published {key}')
    numbers.append(item['number'])
    for dep in item['dependsOn']:
        check(dep in items, f'Unknown dependency {key} -> {dep}')
check(len(set(numbers))==len(numbers), 'Duplicate GitHub work issues')
def visit(key,stack):
    if key in stack:
        errors.append('Dependency cycle: '+' -> '.join(stack+[key]))
        return
    for dep in items[key]['dependsOn']:
        if dep in items:
            visit(dep,stack+[key])
for key in items:
    visit(key,[])

manifest=json.loads((root/'reference/manifest.json').read_text(encoding='utf-8'))
for asset in manifest['assets']:
    file=root/'reference'/asset['path']
    check(file.is_file(), f'Missing asset {asset["path"]}')
    if file.is_file():
        check(hashlib.sha256(file.read_bytes()).hexdigest()==asset['sha256'], f'Changed frozen asset {asset["path"]}')
preview=(root/'reference/clarte.html').read_text(encoding='utf-8')
check('localStorage' not in preview, 'Preview must not use localStorage')
check('clarte.fragment.html' in [a['path'] for a in manifest['assets']], 'Original fragment not fingerprinted')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: links, canonical 15/9/3 fixture, {len(items)} issue specifications, acyclic dependencies, {len(manifest["assets"])} frozen assets')
