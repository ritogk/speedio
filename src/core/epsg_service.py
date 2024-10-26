from geopy.geocoders import Nominatim
import time
# JGD2000の平面直角座標系のEPSGコードと都道府県の対応表
# https://note.sngklab.jp/?p=87
plane_epsg_codes = {
    2443: ['長崎県'],
    2444: ['福岡県', '佐賀県', '熊本県', '大分県', '宮崎県', '鹿児島県'],
    2445: ['山口県', '島根県', '広島県'],
    2446: ['香川県', '愛媛県', '徳島県', '高知県'],
    2447: ['兵庫県', '鳥取県', '岡山県'],
    2448: ['京都府', '大阪府', '福井県', '滋賀県', '三重県', '奈良県', '和歌山県'],
    2449: ['石川県', '富山県', '岐阜県', '愛知県'],
    2450: ['新潟県', '長野県', '山梨県', '静岡県'],
    2451: ['東京都', '福島県', '栃木県', '茨城県', '埼玉県', '千葉県', '群馬県', '神奈川県'],
    2452: ['青森県', '秋田県', '山形県', '岩手県', '宮城県'],
    2454: ['北海道'],
    2457: ['沖縄県'],
}

def generate_epsg_code(prefecture_name: str) -> int|None:
    plane_epsg_code = None
    for code, prefectures in plane_epsg_codes.items():
        if prefecture_name in prefectures:
            plane_epsg_code = code
            break
    return plane_epsg_code

# 緯度経度に最も近い都道府県を求める
def get_nearest_prefecture(latitude: float, longitude: float) -> str:
    geolocator = Nominatim(user_agent="speedio")
    location = geolocator.reverse((latitude, longitude), language='ja')

    if location:
        address = location.raw['address']
        prefecture = address.get('province', None)
    else:
        return None
    return prefecture