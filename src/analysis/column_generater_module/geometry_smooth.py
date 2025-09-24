from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from scipy.interpolate import interp1d
import matplotlib.pyplot as plt


def generate(gdf: GeoDataFrame) -> Series:
    """
    geometry_listを滑らかにする
    スプライン補間を使用して線形補間を行い、より滑らかなジオメトリを生成する
    """
    def smooth_geometry(geometry_list):
        if len(geometry_list) < 2:
            return geometry_list
        
        # 座標をnumpy配列に変換
        coords = np.array(geometry_list)
        
        # 各点間の距離を計算して累積距離を求める
        distances = np.zeros(len(coords))
        for i in range(1, len(coords)):
            # ユークリッド距離を計算
            dist = np.sqrt((coords[i][0] - coords[i-1][0])**2 + (coords[i][1] - coords[i-1][1])**2)
            distances[i] = distances[i-1] + dist
        
        # 累積距離が0の場合は元の座標を返す
        if distances[-1] == 0:
            return geometry_list
        
        # スプライン補間のための新しい距離点を生成
        # 元の点数の2倍の点を生成して滑らかにする
        num_points = max(len(coords) * 2, 10)
        new_distances = np.linspace(0, distances[-1], num_points)
        
        # 各座標軸に対してスプライン補間を実行
        try:
            # 緯度（y座標）の補間
            f_lat = interp1d(distances, coords[:, 1], kind='cubic', bounds_error=False, fill_value='extrapolate')
            new_lats = f_lat(new_distances)
            
            # 経度（x座標）の補間
            f_lon = interp1d(distances, coords[:, 0], kind='cubic', bounds_error=False, fill_value='extrapolate')
            new_lons = f_lon(new_distances)
            
            # 新しい座標リストを作成
            smoothed_coords = [[lon, lat] for lon, lat in zip(new_lons, new_lats)]
            
            return smoothed_coords
            
        except Exception as e:
            # 補間が失敗した場合は元の座標を返す
            print(f"Geometry smoothing failed: {e}")
            return geometry_list
    
    series = gdf["geometry_list"].apply(smooth_geometry)

    # 先頭の一件をmatplotlibで描画 一時的なコードなので後で削除
    if len(gdf) > 0:
        original_geometry = gdf["geometry_list"].iloc[0]
        smoothed_geometry = series.iloc[0]
        
        # 元の座標と滑らか化後の座標を分離
        orig_coords = np.array(original_geometry)
        smooth_coords = np.array(smoothed_geometry)
        
        # 図を作成
        plt.figure(figsize=(14, 10))
        
        # 元のジオメトリを描画（赤い線、太め）
        plt.plot(orig_coords[:, 0], orig_coords[:, 1], 'r-', linewidth=2, 
                label=f'元のジオメトリ ({len(original_geometry)}点)', alpha=0.8, linestyle='-')
        
        # 滑らか化後のジオメトリを描画（青い線）
        plt.plot(smooth_coords[:, 0], smooth_coords[:, 1], 'b-', linewidth=2, 
                label=f'滑らか化後 ({len(smoothed_geometry)}点)', alpha=0.7, linestyle='-')
        
        # グラフの設定
        plt.xlabel('経度 (Longitude)', fontsize=12)
        plt.ylabel('緯度 (Latitude)', fontsize=12)
        plt.title('ジオメトリ滑らか化の比較 (先頭1件)', fontsize=14, fontweight='bold')
        plt.legend(fontsize=11, loc='best')
        plt.grid(True, alpha=0.3, linestyle='--')
        plt.axis('equal')
        
        # 背景色を設定
        plt.gca().set_facecolor('#f8f9fa')
        
        # 表示
        plt.tight_layout()
        plt.show()
        
        # 統計情報を表示
        print("=" * 80)
        print("🌊 ジオメトリ滑らか化の結果表示 (先頭1件)")
        print("=" * 80)
        print(f"元の座標点数: {len(original_geometry)}")
        print(f"滑らか化後の座標点数: {len(smoothed_geometry)}")
        print(f"座標点数増加率: {len(smoothed_geometry) / len(original_geometry):.2f}倍")
        print("\n📍 元の座標 (最初の5点):")
        for i, coord in enumerate(original_geometry[:5]):
            print(f"  {i+1}: [{coord[0]:.6f}, {coord[1]:.6f}]")
        if len(original_geometry) > 5:
            print(f"  ... (他 {len(original_geometry) - 5} 点)")
        
        print("\n🌊 滑らか化後の座標 (最初の10点):")
        for i, coord in enumerate(smoothed_geometry[:10]):
            print(f"  {i+1}: [{coord[0]:.6f}, {coord[1]:.6f}]")
        if len(smoothed_geometry) > 10:
            print(f"  ... (他 {len(smoothed_geometry) - 10} 点)")
        print("=" * 80)
    
    return series
