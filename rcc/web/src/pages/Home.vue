<script setup lang="ts">
import { onMounted, ref, watch, markRaw } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'

const apiKey = import.meta.env.VITE_GOOGLE_MAP_API_KEY

let map: google.maps.Map | null = null

onMounted(() => {
  console.log(apiKey)
  const loader = new Loader({
    apiKey: apiKey,
    version: 'weekly',
    libraries: ['places']
  })
  loader.importLibrary('maps').then((google) => {
    map = new google.Map(document.getElementById('map') as HTMLElement, {
      center: { lat: -34.397, lng: 150.644 },
      zoom: 8
    })
  })
  loader.importLibrary('streetView').then((google) => {
    const panorama = new google.StreetViewPanorama(document.getElementById('pano') as HTMLElement, {
      position: { lat: 35.334261616547465, lng: 136.99613190333835 },
      pov: {
        heading: 34,
        pitch: 10
      }
    })
  })
})
</script>

<template>
  <div style="display: flex; width: 100%">
    <div style="flex: 7; background-color: aqua; height: 750px">
      <div id="pano" style="flex: 5; background-color: aqua; height: 750px">street_view_area</div>
      <div style="width: 100%">
        <div class="button-container">
          <button class="button-style" data-tooltip="戻る">◀</button>
          <button
            class="button-style"
            data-tooltip="2車線かつ路肩あり"
            style="background: palegreen"
          >
            1
          </button>
          <button
            class="button-style"
            data-tooltip="2車線かつ路肩なし"
            style="background: palegreen"
          >
            2
          </button>
          <button
            class="button-style"
            data-tooltip="1車線かつ2台が余裕を持って通行可能"
            style="background: bisque"
          >
            3
          </button>
          <button
            class="button-style"
            data-tooltip="1車線かつ1台のみ通行可能"
            style="background: bisque"
          >
            4
          </button>
          <button class="button-style" data-tooltip="進む">▶</button>
          <span style="margin-left: 10px">1/10</span>
        </div>
      </div>
    </div>
    <div id="map" style="flex: 1; background-color: blueviolet; height: 750px">google_map_area</div>
    <div style="flex: 2; background-color: white">
      <table border="1" style="height: 750px; overflow-y: auto; display: block">
        <thead>
          <tr>
            <th>DB登録</th>
            <th>地理座標</th>
            <th>路面状態</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
          <tr>
            <td scope="row">済</td>
            <td>34.397,150.644</td>
            <td>1</td>
          </tr>
        </tbody>
      </table>
      <div>
        <button>◀</button>
        <button>▶</button>
        <span style="margin-right: 20px">1/10</span>
        <button>csv読込</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.button-container .button-style {
  position: relative;
  width: 50px; /* ボタンの横幅を50pxに設定 */
  height: 50px; /* ボタンの高さを50pxに設定 */
  margin: 5px; /* ボタンの間に少し余白を設ける */
  font-size: 16px; /* テキストのサイズを調整 */
  border: 1px solid #222;
  border-radius: 3px;
}
.button-container {
  text-align: center;
}
.button-container button::after {
  content: attr(data-tooltip); /* data-tooltip属性からテキストを取得 */
  position: absolute;
  white-space: nowrap; /* テキストが折り返さないようにする */
  visibility: hidden;
  bottom: 100%; /* ボタンのすぐ上に配置 */
  left: 50%; /* 中央に配置 */
  transform: translateX(-50%); /* 左に50%分ずらして中央寄せ */
  padding: 5px 10px;
  color: #fff;
  background-color: #333;
  border-radius: 6px;
  z-index: 1000;
}

.button-container button:hover::after {
  visibility: visible; /* ホバー時に見えるように */
}
</style>
