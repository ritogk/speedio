#!/usr/bin/env python3
"""
本宮山スカイラインのセクション計算元データをJSON出力する

usage: python3 pipeline/test/export_hongusan_line_data.py
"""
import json
import os

TARGET_FILE = "data/targets/23/target.json"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "hongusan_line_data.json")


def main():
    with open(TARGET_FILE) as f:
        data = json.load(f)

    touge = None
    for item in data:
        if "本宮山" in item.get("name", ""):
            touge = item
            break

    if not touge:
        print("本宮山スカイラインが見つかりません")
        return

    output = {
        "name": touge["name"],
        "length": touge["length"],
        "highway": touge.get("highway"),
        "geometry_list": touge["geometry_list"],
        "geometry_meter_list": touge["geometry_meter_list"],
        "steering_wheel_angle_info": touge["steering_wheel_angle_info"],
        "road_section": [
            {
                "section_type": s["section_type"],
                "corner_level": s["corner_level"],
                "max_steering_angle": s["max_steering_angle"],
                "avg_steering_angle": s["avg_steering_angle"],
                "distance": s["distance"],
                "points": s["points"],
            }
            for s in touge["road_section"]
        ],
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Name: {output['name']}")
    print(f"Length: {output['length']:.0f}m")
    print(f"geometry_list: {len(output['geometry_list'])} points")
    print(f"geometry_meter_list: {len(output['geometry_meter_list'])} points")
    print(f"steering_wheel_angle_info: {len(output['steering_wheel_angle_info'])} entries")
    print(f"road_section: {len(output['road_section'])} sections")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
