# GMLファイルがあるディレクトリを設定
gml_directory="./gml"
output_directory="./geojson"

# GMLディレクトリ内の各ファイルに対してループ
for gml_file in "$gml_directory"/*.xml; do
    # ファイル名を取得（拡張子なし）
    filename=$(basename "$gml_file" .xml)
    echo $filename

    # 出力ファイルパスを設定
    output="$output_directory/$filename.geojson"

    # GMLをGeoJSONに変換
    ogr2ogr -f "GeoJSON" "$output" "$gml_file"
done

echo "変換完了"