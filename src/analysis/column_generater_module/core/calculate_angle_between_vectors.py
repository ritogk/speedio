import numpy as np


# ベクトル間の角度を計算する
def calculate_angle_between_vectors(A, B, C):
    vector_AB = np.array(B) - np.array(A)
    vector_BC = np.array(C) - np.array(B)

    dot_product = np.dot(vector_AB, vector_BC)
    norm_AB = np.linalg.norm(vector_AB)
    norm_BC = np.linalg.norm(vector_BC)

    cosine_theta = dot_product / (norm_AB * norm_BC)
    angle_rad = np.arccos(cosine_theta)
    angle_deg = np.degrees(angle_rad)
    return angle_deg
