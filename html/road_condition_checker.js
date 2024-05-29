let map;
let panorama;
let polyline;
function initialize() {
  // const fenway = { lat: 42.345573, lng: -71.098326 };
  const fenway = { lat: 35.334261616547465, lng: 136.99613190333835 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: fenway,
    zoom: 14,
    mapTypeId: "roadmap",
  });

  const pathCoordinates = [
    { lat: 35.3342, lng: 136.9945 },
    { lat: 35.34, lng: 136.999 },
    { lat: 35.34, lng: 136.99 },
    { lat: 35.3342, lng: 136.985 },
    { lat: 35.328, lng: 136.99 },
    { lat: 35.328, lng: 136.999 },
    { lat: 35.3342, lng: 136.9945 }, // Closing the loop
  ];
  polyline = new google.maps.Polyline({
    path: pathCoordinates,
    geodesic: true,
    strokeColor: "#FF0000",
    strokeOpacity: 1.0,
    strokeWeight: 2,
  });

  // // Adding the polyline to the map
  polyline.setMap(map);
  panorama = new google.maps.StreetViewPanorama(
    document.getElementById("pano"),
    {
      position: fenway,
      pov: {
        heading: 34,
        pitch: 10,
      },
    }
  );

  map.setStreetView(panorama);
}

export function movePanorama(lat, lng, pov) {
  const position = { lat: 35.3346817353289, lng: 136.9965610567552 };
  panorama.setPosition(position);
}

export function changePolyline() {
  polyline.setMap(null);
  const newPolyline = new google.maps.Polyline({
    path: [
      { lat: 35.3342, lng: 136.9945 },
      { lat: 35.34, lng: 136.999 },
      { lat: 35.34, lng: 136.99 },
    ],
    geodesic: true,
    strokeColor: "#00FF00",
    strokeOpacity: 1.0,
    strokeWeight: 2,
  });
  newPolyline.setMap(map);
}

window.initialize = initialize;
window.movePanorama = movePanorama;
window.changePolyline = changePolyline;
