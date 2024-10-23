import numpy as np

def convert_range(value, old_max, new_min=0, new_max=1):
    # old_minは0に固定されているので省略
    if old_max == 0:  # ゼロ除算を防ぐ
        return new_min
    return (value / old_max) * (new_max - new_min) + new_min

def calculate(actual, predicted):
    # 実際の値と予測値の長さを確認
    if len(actual) != len(predicted):
        raise ValueError("The length of actual and predicted lists must be the same.")
    
    results = []
    for a, p in zip(actual, predicted):
        abs_diff = abs(a - p)
        if abs_diff >= a:
            results.append(0)
        else:
            converted_value = convert_range(abs_diff, a)
            results.append(1 - converted_value)
    
    return np.mean(results)

# 実際の値（期待される割合）
actual_values = [0.3, 0.2, 0.3, 0.2]

# 予測値（現在の割合）
predicted_values = [0.3, 0.2, 0.3, 0.2]

mse = calculate(actual_values, predicted_values)

print(f"Mean Squared Error (MSE): {mse}")
