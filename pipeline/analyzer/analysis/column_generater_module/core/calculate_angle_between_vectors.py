import numpy as np
from typing import Optional, Tuple

# ベクトル間の角度を計算する
def calculate_angle_between_vectors(A, B, C) -> Optional[Tuple[float, str]]:
    vector_AB = np.array(B) - np.array(A)
    vector_BC = np.array(C) - np.array(B)

    dot_product = np.dot(vector_AB, vector_BC)
    norm_AB = np.linalg.norm(vector_AB)
    norm_BC = np.linalg.norm(vector_BC)

    if norm_AB == 0 or norm_BC == 0:
        return None
    cosine_theta = np.clip(dot_product / (norm_AB * norm_BC), -1.0, 1.0)
    angle_rad = np.arccos(cosine_theta)
    angle_deg = np.degrees(angle_rad)

    horizontalVector = "left"
    cross_product = np.cross(vector_AB, vector_BC)
    if cross_product > 0:
        horizontalVector = "left"
    else:
        horizontalVector = "right"
    return angle_deg, horizontalVector
