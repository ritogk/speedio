// viewmodel.js — JSONデータ → 表示用オブジェクト変換
// Uses: App.HIGHWAY_LABEL
// Provides: App.toViewModel(), App.cleanCity(), App.googleMapUrl(), App.yahooCarNaviUrl(), App.streetViewUrl(), App.isEndCloser()
"use strict";

App.cleanCity = function(city){
  if(!city) return null;
  var m = city.match(/^(.+市).+区$/);
  return m ? m[1] : city;
};

App.toViewModel = function(raw, idx){
  var poly = raw.geometry_list || [];
  var center = poly.length ? poly[Math.floor(poly.length/2)] : [35.0,137.0];
  var name = raw.name;
  if(Array.isArray(name)) name = name.filter(Boolean).join(" / ");
  if(!name) name = "（名称未登録の道）";
  var corner = Math.max(0, Math.min(1, 1 - (raw.score_corner_none != null ? raw.score_corner_none : 1)));
  var updown = Math.max(0, Math.min(1, raw.score_elevation_unevenness != null ? raw.score_elevation_unevenness : 0));
  var width = Math.max(0, Math.min(1, raw.score_claude_center_line_section != null ? raw.score_claude_center_line_section : (raw.score_width != null ? raw.score_width : 0)));
  var secs = raw.road_section || [];
  var segStrong=0, segMedium=0, segWeak=0, segStraight=0;
  secs.forEach(function(s){
    var n = Math.max(0, (s.points||[]).length - 1);
    var lv = s.section_type==="straight" ? "none" : (s.corner_level||"none");
    if(lv==="strong") segStrong+=n;
    else if(lv==="medium") segMedium+=n;
    else if(lv==="weak") segWeak+=n;
    else segStraight+=n;
  });
  var segTotal = segStrong+segMedium+segWeak+segStraight || 1;
  var _gl = poly;
  var stableKey = null;
  if(_gl.length){
    var _p1 = _gl[0][0]+","+_gl[0][1];
    var _p2 = _gl[_gl.length-1][0]+","+_gl[_gl.length-1][1];
    var _sorted = _p1 < _p2 ? _p1+"-"+_p2 : _p2+"-"+_p1;
    stableKey = name+"|"+_sorted;
  }
  return {
    id: idx, name: name, stableKey: stableKey,
    routeLabel: App.HIGHWAY_LABEL[Array.isArray(raw.highway) ? raw.highway[0] : raw.highway] || "一般道",
    lengthKm: Math.round((raw.length || 0) / 100) / 10,
    height: Math.round(raw.elevation_height || 0),
    buildingCnt: raw.building_nearby_cnt != null ? raw.building_nearby_cnt : null,
    buildingDensity: (raw.building_nearby_cnt != null && raw.length > 0) ? Math.round(raw.building_nearby_cnt / (raw.length / 1000) * 10) / 10 : null,
    pctStrong: Math.round(segStrong/segTotal*100),
    pctMedium: Math.round(segMedium/segTotal*100),
    pctWeak: Math.round(segWeak/segTotal*100),
    pctStraight: Math.round(segStraight/segTotal*100),
    corner: corner, updown: updown, width: width,
    scoreElevation: raw.score_elevation != null ? raw.score_elevation : 0,
    scoreElevationFlat: raw.score_elevation_flat != null ? raw.score_elevation_flat : 0,
    scoreElevationGentle: raw.score_elevation_gentle != null ? raw.score_elevation_gentle : 0,
    scoreElevationModerate: raw.score_elevation_moderate != null ? raw.score_elevation_moderate : 0,
    scoreElevationSteep: raw.score_elevation_steep != null ? raw.score_elevation_steep : 0,
    elevationSection: raw.elevation_section || [],
    scoreElevationUnevenness: raw.score_elevation_unevenness != null ? raw.score_elevation_unevenness : 0,
    scoreWidth: raw.score_width != null ? raw.score_width : 0,
    scoreLength: raw.score_length != null ? raw.score_length : 0,
    scoreBuilding: raw.score_building != null ? raw.score_building : 0,
    scoreTunnelOutside: raw.score_tunnel_outside != null ? raw.score_tunnel_outside : 0,
    scoreCornerWeek: raw.score_corner_week != null ? raw.score_corner_week : 0,
    scoreCornerMedium: raw.score_corner_medium != null ? raw.score_corner_medium : 0,
    scoreCornerStrong: raw.score_corner_strong != null ? raw.score_corner_strong : 0,
    scoreCornerNone: raw.score_corner_none != null ? raw.score_corner_none : 0,
    scoreCornerBalance: raw.score_corner_balance != null ? raw.score_corner_balance : 0,
    scoreClaudeCenterLineSection: raw.score_claude_center_line_section != null ? raw.score_claude_center_line_section : 0,
    unevennessCount: raw.elevation_unevenness_count != null ? raw.elevation_unevenness_count : null,
    uphillCnt: raw.uphill_cnt != null ? raw.uphill_cnt : null,
    downhillCnt: raw.downhill_cnt != null ? raw.downhill_cnt : null,
    prefecture: raw.prefecture || null,
    city: App.cleanCity(raw.city),
    center: center, poly: poly,
    roadSection: secs,
    elevationSmooth: raw.elevation_smooth || [],
    elevSections: raw.elevation_unevenness_sections || null,
    buildings: raw.buildings || [],
    googleEarthUrl: raw.google_earth_url,
    tunnelSections: raw.tunnel_sections || [],
    bridgeSections: raw.bridge_sections || []
  };
};

App.isEndCloser = function(poly, lat, lng){
  if(!poly.length || lat == null) return false;
  var d2 = function(a){ return (a[0]-lat)*(a[0]-lat)+(a[1]-lng)*(a[1]-lng); };
  return d2(poly[poly.length-1]) < d2(poly[0]);
};

App.googleMapUrl = function(poly, lat, lng){
  if(!poly.length) return "#";
  var st = poly[0], ct = poly[Math.floor(poly.length/2)], ed = poly[poly.length-1];
  if(App.isEndCloser(poly, lat, lng)){ var tmp=st; st=ed; ed=tmp; }
  var origin = lat!=null ? lat+","+lng : "current+location";
  return "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin="+origin+"&destination="+ed[0]+","+ed[1]+"&waypoints="+st[0]+","+st[1]+"|"+ct[0]+","+ct[1];
};

App.yahooCarNaviUrl = function(poly, lat, lng){
  if(!poly.length) return "#";
  var st = poly[0], ct = poly[Math.floor(poly.length/2)], ed = poly[poly.length-1];
  if(App.isEndCloser(poly, lat, lng)){ var tmp=st; st=ed; ed=tmp; }
  return "yjcarnavi://navi/select?point=current&point="+st[0]+","+st[1]+",&point="+ct[0]+","+ct[1]+",&point="+ed[0]+","+ed[1]+",";
};

App.streetViewUrl = function(poly){
  if(poly.length < 2) return null;
  var i = Math.floor(poly.length/2);
  var a = poly[Math.max(0, i-1)], b = poly[Math.min(poly.length-1, i+1)], c = poly[i];
  var toRad = function(d){ return d*Math.PI/180; };
  var dLng = toRad(b[1]-a[1]);
  var y = Math.sin(dLng)*Math.cos(toRad(b[0]));
  var x = Math.cos(toRad(a[0]))*Math.sin(toRad(b[0])) - Math.sin(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.cos(dLng);
  var heading = Math.round((Math.atan2(y,x)*180/Math.PI + 360) % 360);
  return "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint="+c[0]+","+c[1]+"&heading="+heading+"&pitch=0&fov=90";
};
