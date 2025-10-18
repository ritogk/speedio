from src.elevation_formatter import main

import geopandas as gpd
import matplotlib.pyplot as plt
from src.core.env import getEnv
from src.analysis.column_generater_module.score_corner_level import WEEK_CORNER_ANGLE_MIN, WEEK_CORNER_ANGLE_MAX, MEDIUM_CORNER_ANGLE_MIN, MEDIUM_CORNER_ANGLE_MAX, STRONG_CORNER_ANGLE_MIN
from src.core.execution_timer import ExecutionTimer, ExecutionType
from src.core.epsg_service import generate_epsg_code, get_nearest_prefecture
from shapely.geometry import Polygon
from src.core.prefecture_polygon import find_prefecture_polygon
import os
from src.core.prefecture import prefecture_codes

import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString

CSV_PATH = r"./gps_records_363.csv"

def run():
    env = getEnv()

    # 緯度経度から座標リストを作成
    # CSVを読み込む
    df = pd.read_csv(CSV_PATH)
    coords = list(zip(df["longitude"], df["latitude"]))

    # coordsからbboxのpolygonを作成
    min_lon = df["longitude"].min()
    max_lon = df["longitude"].max()
    min_lat = df["latitude"].min()
    max_lat = df["latitude"].max()
    bbox_polygon = Polygon([
        (min_lon, min_lat),
        (max_lon, min_lat),
        (max_lon, max_lat),
        (min_lon, max_lat)
    ])

    execution_timer_ins = ExecutionTimer()

    search_all_prefectures = env["SEARCH_ALL_PREFECTURES"]
    if(not search_all_prefectures):
        area_prefecture_name = env["AREA_PREFECTURE_NAME"]
        use_custom_area = env["USE_CUSTOM_AREA"]
        custom_area_point_st = env["CUSTOM_AREA_POINT_ST"]
        custom_area_point_ed = env["CUSTOM_AREA_POINT_ED"]
        plane_epsg_code = None

        # 対象範囲のポリゴンを取得する
        execution_timer_ins.start("📍 get plane epsg code", ExecutionType.PROC)
        if use_custom_area:
            area_prefecture_name = get_nearest_prefecture(custom_area_point_st[0], custom_area_point_st[1])
            plane_epsg_code = generate_epsg_code(area_prefecture_name)
        else:
            plane_epsg_code = generate_epsg_code(area_prefecture_name)
        prefecture_code = prefecture_codes[area_prefecture_name]
        print(f"  prefecture_name: {area_prefecture_name}, prefecture_code: {prefecture_code}, plane_epsg_code: {plane_epsg_code}")
        execution_timer_ins.stop()

        # 対象範囲のポリゴンを取得する
        execution_timer_ins.start("🗾 get target area polygon", ExecutionType.PROC)
        if use_custom_area:
            top_left = (custom_area_point_st[1], custom_area_point_st[0])
            bottom_right = (custom_area_point_ed[1], custom_area_point_ed[0])
            top_right = (bottom_right[0], top_left[1])  # 右上
            bottom_left = (top_left[0], bottom_right[1])  # 左下
            search_area_polygon = Polygon([top_left, top_right, bottom_right, bottom_left])
        else:
            prefectures_geojson_path = f"{os.path.dirname(os.path.abspath(__file__))}/./prefectures.geojson"
            search_area_polygon = find_prefecture_polygon(prefectures_geojson_path, area_prefecture_name)
        execution_timer_ins.stop()

        # メインロジック
        gdf = main(bbox_polygon, plane_epsg_code, prefecture_code, coords)
    else:
        for prefecture_name, prefecture_code in prefecture_codes.items():
            execution_timer_ins.start("📍 get plane epsg code", ExecutionType.PROC)
            plane_epsg_code = generate_epsg_code(prefecture_name)
            print(f"  prefecture_name: {prefecture_name}, prefecture_code: {prefecture_code}, plane_epsg_code: {plane_epsg_code}")
            execution_timer_ins.stop()

            execution_timer_ins.start("🗾 get target area polygon", ExecutionType.PROC)
            prefectures_geojson_path = f"{os.path.dirname(os.path.abspath(__file__))}/./prefectures.geojson"
            search_area_polygon = find_prefecture_polygon(prefectures_geojson_path, prefecture_name)
            execution_timer_ins.stop()

            gdf = main(search_area_polygon, plane_epsg_code, prefecture_code, coords)
        return

    # gdfにdfのtimestampをすべて追加
    # gdfにtimestamp列を追加
    
    # timestamp カラムを「各行がリスト」を入れられる object 型で初期化
    gdf["timestamp"] = pd.Series([[] for _ in range(len(gdf))], dtype="object")

    # 本体のセルに安全に代入（ここでは 0 行目にまとめて入れる想定）
    idx0 = gdf.index[0]
    gdf.at[idx0, "timestamp"] = df["timestamp"].tolist()  # ← 一重リストをそのまま

    # gdfのgeometryとelevationをx
    output_columns = [
        "latitude",
        "longitude",
        "elevation",
        "x",
        "y",
        "timestamp",
    ]

    print(df["timestamp"].tolist())

    # output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/./output_gps_records.csv"
    # gdf[output_columns].to_csv(output_dir, index=False)

    
    # listカラムを1行ずつ展開（同じ長さのlistを想定）
    exploded_df = pd.DataFrame({
        "latitude": gdf["latitude"].explode().reset_index(drop=True),
        "longitude": gdf["longitude"].explode().reset_index(drop=True),
        "elevation": gdf["elevation_smooth"].explode().reset_index(drop=True),
        "x": gdf["x"].explode().reset_index(drop=True),
        "y": gdf["y"].explode().reset_index(drop=True),
        "timestamp": gdf["timestamp"].explode().reset_index(drop=True)
    })

    # 出力
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output_gps_records.csv")
    exploded_df.to_csv(output_dir, index=False)
    print(f"✅ CSV 出力完了: {output_dir}")



run()
