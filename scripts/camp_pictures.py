"""
Camp pictures for the audit page's camp sheets.

The audit page (a claude.ai artifact) cannot load pictures from images.iclasspro.com - its security blocks
outside pictures. So every camp picture is downloaded once, made web-sized, and uploaded into the page's own
picture storage (assets); the page's `pictures` collection maps each iClass picture to its uploaded copy.

This script does the first half, for every picture on every gym's sheet that is NOT in `pictures/map` yet:
download -> resize (longest side 1000px, enough to read every word printed on it) -> <out>/<id>.jpg,
and <out>/TO_UPLOAD.json lists them. Claude then copies them into a git-ignored `_audit_pics/` folder in the
repo (the upload tool takes groups of 25 only from inside the project), uploads them in sorted order
(Artifact asset upload, 25 per call), checks each upload's sha256 against the page's asset list, and adds
{id: url} to the one `pictures/map` doc (`urls`). READ-ONLY on iClass and Supabase.
First run 2026-11-05: 220 pictures, 21.6 MB, 0 failed.

Usage: python scripts/camp_pictures.py --page <folder with sheets/ and pictures/> --out <folder>
"""
import argparse, glob, io, json, os, urllib.request

from PIL import Image

MAX_SIDE = 1000


def pic_id(url):
    # .../camps/1762964010.969790b2...jpg -> 1762964010.969790b2...  (unique per uploaded iClass picture)
    return os.path.splitext(url.rstrip('/').split('/')[-1])[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    # the page keeps ONE doc, pictures/map: {urls: {picture id: copy url}}
    mp = os.path.join(a.page, 'pictures', 'map.json')
    have = set((json.load(open(mp, encoding='utf-8')).get('urls') or {}).keys()) if os.path.exists(mp) else set()
    wanted = {}
    for f in glob.glob(os.path.join(a.page, 'sheets', '*.json')):
        for c in json.load(open(f, encoding='utf-8')).get('camps') or []:
            if c.get('picture'):
                wanted[pic_id(c['picture'])] = c['picture']
    todo, failed = [], []
    for pid, url in sorted(wanted.items()):
        if pid in have:
            continue
        try:
            raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'camp-audit'}), timeout=30).read()
            im = Image.open(io.BytesIO(raw)).convert('RGB')
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            path = os.path.join(a.out, f'{pid}.jpg')
            im.save(path, 'JPEG', quality=82, optimize=True)
            todo.append({'id': pid, 'path': url, 'file': path, 'bytes': os.path.getsize(path)})
        except Exception as e:
            failed.append({'id': pid, 'path': url, 'error': str(e)})
    json.dump({'upload': todo, 'failed': failed}, open(os.path.join(a.out, 'TO_UPLOAD.json'), 'w', encoding='utf-8'), indent=1)
    print(f"{len(wanted)} pictures on the sheets, {len(have)} already on the page, {len(todo)} ready to upload "
          f"({sum(t['bytes'] for t in todo) // 1024} KB), {len(failed)} failed")
    for x in failed:
        print('  FAILED', x['path'], x['error'])


if __name__ == '__main__':
    main()
