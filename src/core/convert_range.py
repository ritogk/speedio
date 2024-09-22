def convert_range(value, old_min, old_max, new_min, new_max):
    # 線形補間を使用して新しい範囲に変換
    return ((value - old_min) / (old_max - old_min)) * (new_max - new_min) + new_min