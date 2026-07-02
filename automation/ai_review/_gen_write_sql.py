"""Generate escaped UPDATE statements from an AI review flags JSON file."""
import json
import sys

src = sys.argv[1] if len(sys.argv) > 1 else r'automation\ai_review\run_2026-07-02_flags.json'
rows = json.load(open(src, encoding='utf-8'))
stmts = []
for r in rows:
    fj = json.dumps(r['flags'], ensure_ascii=False).replace("'", "''")
    stmts.append(
        "UPDATE events SET ai_review_flags = '%s'::jsonb, ai_reviewed_at = now() WHERE id = '%s';" % (fj, r['id'])
    )
half = len(stmts) // 2
open(r'automation\ai_review\_write_flags_part1.sql', 'w', encoding='utf-8').write('\n'.join(stmts[:half]))
open(r'automation\ai_review\_write_flags_part2.sql', 'w', encoding='utf-8').write('\n'.join(stmts[half:]))
print('%d events, %d statements, split %d/%d' % (len(rows), len(stmts), half, len(stmts) - half))
