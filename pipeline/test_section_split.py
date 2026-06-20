#!/usr/bin/env python3
"""
セクション分割ロジックのテストスクリプト
本宮山スカイラインで動作確認する

usage: python3 pipeline/test_section_split.py
"""
import json
import statistics
from collections import Counter
from geopy.distance import geodesic
import matplotlib.pyplot as plt
import matplotlib

# === 定数 ===
ANGLE_SMOOTH_WINDOW = 3      # 角度のメディアンフィルタ窓(小さめでピーク保持)
DIRECTION_SMOOTH_WINDOW = 5  # 方向のモードフィルタ窓
MIN_SECTION_POINTS = 3       # セクション最小ポイント数(これ未満は隣にマージ)

# デフォルト閾値 (straight_max, weak_max, medium_max)
# スムージング後の角度に合わせて旧ロジック(7/45/80)より低めに設定
DEFAULT_THRESHOLDS = (5, 20, 45)


# matplotlib色設定
# 右コーナー=青系(弱→強で濃く)、左コーナー=赤系(弱→強で濃く)、ストレート=グレー
COLOR_MAP = {
    ('straight', 'none'):    '#BBBBBB',
    ('right',    'weak'):    '#90CAF9',  # 薄い青
    ('right',    'medium'):  '#1E88E5',  # 青
    ('right',    'strong'):  '#0D47A1',  # 濃い青
    ('left',     'weak'):    '#EF9A9A',  # 薄い赤
    ('left',     'medium'):  '#E53935',  # 赤
    ('left',     'strong'):  '#7F0000',  # 濃い赤
}


def median_filter(values, window):
    """メディアンフィルタでノイズ除去"""
    half = window // 2
    result = []
    for i in range(len(values)):
        start = max(0, i - half)
        end = min(len(values), i + half + 1)
        result.append(statistics.median(values[start:end]))
    return result


def mode_filter(values, window):
    """最頻値フィルタ"""
    half = window // 2
    result = []
    for i in range(len(values)):
        start = max(0, i - half)
        end = min(len(values), i + half + 1)
        counter = Counter(values[start:end])
        result.append(counter.most_common(1)[0][0])
    return result


def classify_point(angle, direction, thresholds):
    """スムージング済みの角度と方向から7分類"""
    straight_max, weak_max, medium_max = thresholds
    if angle < straight_max:
        return ('straight', 'none')
    elif angle < weak_max:
        return (direction, 'weak')
    elif angle < medium_max:
        return (direction, 'medium')
    else:
        return (direction, 'strong')


def split_sections(steering_wheel_angle_info, thresholds, angle_window=3, dir_window=7):
    """
    セクション分割:
    1. メディアンフィルタで角度をスムージング
    2. モードフィルタで方向をスムージング
    3. スムージング後の値で7分類
    4. 分類が変わったら切る
    5. 短すぎるセクションを隣にマージ
    """
    if not steering_wheel_angle_info:
        return []

    straight_max = thresholds[0]
    n = len(steering_wheel_angle_info)
    raw_angles = [p['steering_angle'] for p in steering_wheel_angle_info]
    raw_directions = [p['direction'] for p in steering_wheel_angle_info]

    smoothed_angles = median_filter(raw_angles, angle_window)
    smoothed_directions = mode_filter(raw_directions, dir_window)

    # straight判定: スムージング後の角度が閾値未満ならstraight
    effective_directions = [
        'straight' if smoothed_angles[i] < straight_max else smoothed_directions[i]
        for i in range(n)
    ]

    # 分類
    classifications = [
        classify_point(smoothed_angles[i], effective_directions[i], thresholds)
        for i in range(n)
    ]

    # グループ化
    sections = []
    current_type = classifications[0]
    current_indices = [0]
    for i in range(1, n):
        if classifications[i] != current_type:
            sections.append({'type': current_type, 'indices': current_indices})
            current_type = classifications[i]
            current_indices = [i]
        else:
            current_indices.append(i)
    sections.append({'type': current_type, 'indices': current_indices})

    # 短いセクション(MIN_SECTION_POINTS未満)を隣にマージ
    sections = merge_short_sections(sections)

    # steering_angle_infoを付与
    for sec in sections:
        sec['steering_angle_info'] = [steering_wheel_angle_info[i] for i in sec['indices']]

    return sections


def merge_short_sections(sections):
    """短すぎるセクションを隣のセクションにマージ"""
    changed = True
    while changed:
        changed = False
        new_sections = []
        i = 0
        while i < len(sections):
            sec = sections[i]
            if len(sec['indices']) < MIN_SECTION_POINTS and len(sections) > 1:
                # 前後のセクションのうちポイント数が多い方にマージ
                prev_len = len(new_sections[-1]['indices']) if new_sections else 0
                next_len = len(sections[i + 1]['indices']) if i + 1 < len(sections) else 0

                if prev_len >= next_len and new_sections:
                    new_sections[-1]['indices'].extend(sec['indices'])
                elif i + 1 < len(sections):
                    sections[i + 1]['indices'] = sec['indices'] + sections[i + 1]['indices']
                else:
                    new_sections.append(sec)
                changed = True
            else:
                new_sections.append(sec)
            i += 1
        sections = new_sections

    # マージ後に同一タイプが連続している場合を結合
    merged = [sections[0]]
    for sec in sections[1:]:
        if sec['type'] == merged[-1]['type']:
            merged[-1]['indices'].extend(sec['indices'])
        else:
            merged.append(sec)
    return merged


def build_section_data(sections):
    """セクションデータを整形する"""
    result = []
    for sec in sections:
        infos = sec['steering_angle_info']
        direction, corner_level = sec['type']

        points = []
        for x in infos:
            points.append(tuple(x['start']))
            points.append(tuple(x['center']))
            points.append(tuple(x['end']))
        points = list(dict.fromkeys(points))

        distance = 0
        for i in range(len(points) - 1):
            distance += geodesic(reversed(points[i]), reversed(points[i + 1])).meters

        max_angle = max(x['steering_angle'] for x in infos)
        avg_angle = sum(x['steering_angle'] for x in infos) / len(infos)

        result.append({
            'section_type': direction,
            'corner_level': corner_level,
            'max_steering_angle': max_angle,
            'avg_steering_angle': avg_angle,
            'distance': distance,
            'points': points,
            'point_count': len(points),
            'info_count': len(infos),
        })
    return result


def print_sections(sections, label):
    """セクション一覧を表示"""
    print(f"\n{'='*80}")
    print(f" {label}")
    print(f"{'='*80}")
    total_dist = sum(s['distance'] for s in sections)
    for i, s in enumerate(sections):
        type_label = f"{s['section_type']}-{s['corner_level']}" if s['section_type'] != 'straight' else 'straight'
        print(f"  {i:3d}: {type_label:14s}  max_angle={s['max_steering_angle']:6.1f}  "
              f"avg={s['avg_steering_angle']:5.1f}  dist={s['distance']:7.1f}m  pts={s['point_count']}")
    print(f"  --- total: {len(sections)} sections, {total_dist:.0f}m ---")

    summary = {}
    for s in sections:
        key = f"{s['section_type']}-{s['corner_level']}" if s['section_type'] != 'straight' else 'straight'
        summary.setdefault(key, 0)
        summary[key] += s['distance']
    print(f"\n  距離サマリ:")
    for k, v in sorted(summary.items()):
        print(f"    {k:14s}: {v:7.0f}m ({v/total_dist*100:5.1f}%)")


def plot_all(all_results, title):
    """全閾値セットを横並びで色分け描画"""
    matplotlib.rcParams['font.family'] = 'DejaVu Sans'
    n_plots = len(all_results)
    fig, axes = plt.subplots(1, n_plots, figsize=(8 * n_plots, 10))
    if n_plots == 1:
        axes = [axes]

    for ax, (name, sections) in zip(axes, all_results.items()):
        for sec in sections:
            pts = sec['points']
            if len(pts) < 2:
                continue
            lats = [p[0] for p in pts]
            lngs = [p[1] for p in pts]
            color = COLOR_MAP.get((sec['section_type'], sec['corner_level']), '#000000')
            ax.plot(lngs, lats, color=color, linewidth=3.0)

        legend_entries = {}
        for sec in sections:
            key = (sec['section_type'], sec['corner_level'])
            if key not in legend_entries:
                color = COLOR_MAP.get(key, '#000000')
                label = f"{key[0]}-{key[1]}" if key[0] != 'straight' else 'straight'
                legend_entries[key] = plt.Line2D([0], [0], color=color, linewidth=3.0, label=label)
        ax.legend(handles=legend_entries.values(), loc='best', fontsize=8)
        ax.set_title(f'{name} ({len(sections)} sections)', fontsize=12)
        ax.set_aspect('equal')

    fig.suptitle(f'{title}', fontsize=14, y=1.02)
    plt.tight_layout()
    out_path = 'pipeline/test_section_split.png'
    plt.savefig(out_path, dpi=150, bbox_inches='tight')
    print(f"\n  Plot saved to: {out_path}")
    plt.close()


def main():
    with open('data/targets/23/target.json') as f:
        data = json.load(f)

    touge = None
    for item in data:
        if '本宮山' in item.get('name', ''):
            touge = item
            break

    if not touge:
        print("本宮山スカイラインが見つかりません")
        return

    print(f"Name: {touge['name']}")
    print(f"Length: {touge['length']:.0f}m")
    print(f"Steering angle info points: {len(touge['steering_wheel_angle_info'])}")

    # --- 旧セクション ---
    old_sections = []
    for s in touge.get('road_section', []):
        old_sections.append({
            'section_type': s['section_type'],
            'corner_level': s['corner_level'],
            'max_steering_angle': s['max_steering_angle'],
            'avg_steering_angle': s['avg_steering_angle'],
            'distance': s['distance'],
            'points': s['points'],
            'point_count': len(s['points']),
            'info_count': len(s.get('section_info', [])),
        })
    print_sections(old_sections, '旧ロジック (既存)')

    # --- 新セクション ---
    raw_sections = split_sections(touge['steering_wheel_angle_info'], DEFAULT_THRESHOLDS,
                                  angle_window=ANGLE_SMOOTH_WINDOW, dir_window=DIRECTION_SMOOTH_WINDOW)
    new_sections = build_section_data(raw_sections)
    print_sections(new_sections, f'新ロジック thresh={DEFAULT_THRESHOLDS}')

    # --- プロット(旧vs新) ---
    plot_all({f'Old ({len(old_sections)} sections)': old_sections,
              f'New ({len(new_sections)} sections)': new_sections}, touge['name'])


if __name__ == '__main__':
    main()
