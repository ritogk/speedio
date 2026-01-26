#!/usr/bin/env python3
"""
動画データ生成処理の統合スクリプト

以下の処理を順序実行：
1. generateSegmentTimestamps.py - GPS タイムスタンプを付与した区間ポイント生成
2. generateKml.py - KML ファイル生成
"""

import subprocess
import sys
from pathlib import Path


def run_script(script_path: Path) -> bool:
	"""スクリプトを実行し、成功したら True、失敗したら False を返す。"""
	
	print(f"\n{'='*60}")
	print(f"実行中: {script_path.name}")
	print(f"{'='*60}\n")
	
	result = subprocess.run(
		[sys.executable, str(script_path)],
		cwd=str(script_path.parent)
	)
	
	if result.returncode != 0:
		print(f"\n❌ エラー: {script_path.name} の実行に失敗しました。")
		return False
	
	print(f"\n✓ {script_path.name} が完了しました。")
	return True


def main() -> None:
	"""メイン処理：全スクリプトを順序実行。"""
	
	base_dir = Path(__file__).resolve().parent
	
	scripts = [
		base_dir / "data-generator" / "generateSegmentTimestamps.py",
		base_dir / "kml_generator" / "generateKml.py",
	]
	
	print("\n" + "="*60)
	print("動画データ生成処理を開始します")
	print("="*60)
	
	# 全スクリプトが存在するか確認
	for script_path in scripts:
		if not script_path.exists():
			print(f"❌ エラー: スクリプトが見つかりません: {script_path}")
			sys.exit(1)
	
	# 順序実行
	failed_scripts = []
	for script_path in scripts:
		if not run_script(script_path):
			failed_scripts.append(script_path.name)
	
	# 結果サマリー
	print(f"\n{'='*60}")
	print("処理完了サマリー")
	print(f"{'='*60}\n")
	
	if not failed_scripts:
		print("✅ すべての処理が正常に完了しました。")
		sys.exit(0)
	else:
		print(f"❌ 以下のスクリプトでエラーが発生しました:")
		for script_name in failed_scripts:
			print(f"   - {script_name}")
		sys.exit(1)


if __name__ == "__main__":
	main()
