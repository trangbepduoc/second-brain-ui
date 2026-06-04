#!/usr/bin/env python3
import argparse, json
from pathlib import Path

DATA = Path('/home/openclaw/.openclaw/workspace/second-brain/data/notes.json')
if not DATA.exists():
    print('[]')
    raise SystemExit

notes = json.loads(DATA.read_text(encoding='utf-8'))
p = argparse.ArgumentParser()
p.add_argument('--tag', default='')
p.add_argument('--search', default='')
p.add_argument('--limit', type=int, default=20)
args = p.parse_args()

rows = notes
if args.tag:
    rows = [n for n in rows if args.tag in n.get('tags', [])]
if args.search:
    q = args.search.lower()
    rows = [n for n in rows if q in n.get('title','').lower() or q in n.get('content','').lower()]

for n in rows[:args.limit]:
    print(f"- {n['id']} | {n['title']} | tags={','.join(n.get('tags',[]))} | updated={n.get('updated_at','')}")
