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
})
</script>

<template>
  <div id="map" style="height: 400px">Loading map...</div>
  <div style="display: flex; width: 100%">
    <div style="flex: 3; background-color: aqua">street_view_area</div>
    <div style="flex: 1; background-color: blueviolet">google_map_area</div>
    <div style="flex: 1; background-color: darkgreen">control-area</div>
  </div>
</template>
