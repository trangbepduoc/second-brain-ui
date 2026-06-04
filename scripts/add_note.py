#!/usr/bin/env python3
import argparse, json, uuid
from datetime import datetime
from pathlib import Path

DATA = Path('/home/openclaw/.openclaw/workspace/second-brain/data/notes.json')
DATA.parent.mkdir(parents=True, exist_ok=True)
if not DATA.exists():
    DATA.write_text('[]', encoding='utf-8')

p = argparse.ArgumentParser()
p.add_argument('--title', required=True)
p.add_argument('--content', required=True)
p.add_argument('--tags', default='')
p.add_argument('--source', default='chat')
args = p.parse_args()

notes = json.loads(DATA.read_text(encoding='utf-8'))
now = datetime.now().isoformat()
note = {
    'id': str(uuid.uuid4()),
    'title': args.title.strip(),
    'content': args.content.strip(),
    'tags': [t.strip() for t in args.tags.split(',') if t.strip()],
    'created_at': now,
    'updated_at': now,
    'linked_notes': [],
    'source': args.source
}
notes.append(note)
DATA.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding='utf-8')
print(note['id'])
