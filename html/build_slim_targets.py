#!/usr/bin/env python3
"""
S3上の targets/{pref}/target.json からビュワー(index_3.html)用の軽量版
target.slim.json を生成し、gzip圧縮(+Content-Encoding: gzip)でS3に併置する。

- 元の target.json は変更しない（バックアップ: targets_bk_20260611/）
- CloudFrontの自動圧縮は10MB超で効かないため、事前gzipで配信する
- 座標は小数5桁(≈1m精度)に丸める

usage: python3 build_slim_targets.py [pref_code ...]   # 省略時は全県
"""
import gzip
import json
import subprocess
import sys
import tempfile
from pathlib import Path

BUCKET = "speediomainstack-createbucketefe7ef15-bdy9vvhyqygf"
PREFS = [f"{i:02d}" for i in range(1, 48)]


def r5(v):
    return round(v, 5)


def slim_touge(t):
    return {
        "length": t.get("length"),
        "highway": t.get("highway"),
        "name": t.get("name"),
        "elevation_height": t.get("elevation_height"),
        "score_elevation": t.get("score_elevation"),
        "score_elevation_unevenness": t.get("score_elevation_unevenness"),
        "score_width": t.get("score_width"),
        "score_corner_none": t.get("score_corner_none"),
        "geometry_list": [[r5(p[0]), r5(p[1])] for p in t.get("geometry_list") or []],
        "road_section": [
            {
                "section_type": s.get("section_type"),
                "corner_level": s.get("corner_level"),
                "points": [[r5(p[0]), r5(p[1])] for p in s.get("points") or []],
            }
            for s in t.get("road_section") or []
        ],
    }


def main():
    prefs = sys.argv[1:] or PREFS
    for code in prefs:
        src = f"s3://{BUCKET}/targets/{code}/target.json"
        dst = f"s3://{BUCKET}/targets/{code}/target.slim.json"
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "target.json"
            gz_path = Path(tmp) / "target.slim.json"
            r = subprocess.run(["aws", "s3", "cp", src, str(raw_path), "--only-show-errors"])
            if r.returncode != 0:
                print(f"[{code}] SKIP (download failed)")
                continue
            data = json.loads(raw_path.read_text())
            slim = [slim_touge(t) for t in data]
            body = json.dumps(slim, ensure_ascii=False, separators=(",", ":")).encode()
            gz_path.write_bytes(gzip.compress(body, 9))
            subprocess.run([
                "aws", "s3", "cp", str(gz_path), dst,
                "--content-type", "application/json",
                "--content-encoding", "gzip",
                "--cache-control", "public, max-age=86400",
                "--only-show-errors",
            ], check=True)
            print(f"[{code}] {raw_path.stat().st_size/1e6:6.1f}MB -> slim {len(body)/1e6:5.2f}MB -> gzip {gz_path.stat().st_size/1e6:5.2f}MB ({len(slim)}件)")


if __name__ == "__main__":
    main()
