from scipy.signal import find_peaks
import numpy as np


def detect_peaks(elevation_segment_list: list[float], distance: int = 3, prominence: float = 10):
    min_elevation = min(elevation_segment_list)
    elevations = np.array([e - min_elevation for e in elevation_segment_list])

    peaks, _ = find_peaks(elevations, distance=distance, prominence=prominence)
    elevations_inverted = np.max(elevations) - elevations
    peaks_inverted, _ = find_peaks(elevations_inverted, distance=distance, prominence=prominence)

    return peaks, peaks_inverted, elevations
