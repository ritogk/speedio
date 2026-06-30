// overlay-3d.js — Three.js 3Dビューオーバーレイ
// Uses: App.map, App.$, App.toast, App.showLoading, App.escapeHtml, App.isEndCloser, App.userLatLng, App.sampleElevations
// Provides: App.open3DView(), App.close3DView(), App.init3D(), App.has3DActive()
"use strict";

var active3D = null;
var threeLib = null;


async function loadThreeJS(){
  if(threeLib) return threeLib;
  var [THREE, orbitMod, l2Mod, lmMod, lgMod] = await Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/lines/Line2.js'),
    import('three/addons/lines/LineMaterial.js'),
    import('three/addons/lines/LineGeometry.js')
  ]);
  threeLib = {THREE, OrbitControls: orbitMod.OrbitControls,
    Line2: l2Mod.Line2, LineMaterial: lmMod.LineMaterial, LineGeometry: lgMod.LineGeometry};
  return threeLib;
}



App.open3DView = async function(t){
  if(active3D) App.close3DView();
  App.showLoading(true, "3Dデータを準備中…");
  try{
    var threeResult = await loadThreeJS();
    var {THREE, OrbitControls, Line2, LineMaterial, LineGeometry} = threeResult;

    var geomList = t.poly;
    var elevSmooth = t.elevationSmooth || [];
    if(geomList.length < 2 || elevSmooth.length < 2){ App.toast("3Dデータが不十分です"); return; }

    var LEVEL_HEX = {
      strong:0xFF453A, medium:0xFF9F0A, weak:0x30D158,
      straight:0x98989D, none:0x98989D
    };

    // geometry_list + elevation_smoothを直接使用（1:1インデックス対応）
    // road_sectionのコーナーレベルを順方向マッチングで割り当て
    var ptLevels = new Array(geomList.length).fill("straight");
    var cursor = 0;
    var roadSecs = t.roadSection || [];
    roadSecs.forEach(sec => {
      var pts = sec.points || [];
      if(pts.length < 2) return;
      var level = sec.section_type === "straight" ? "straight" : (sec.corner_level || "weak");
      var fLat = pts[0][1], fLng = pts[0][0];
      var si = cursor, bestD = Infinity;
      for(var i = cursor; i < Math.min(cursor + 150, geomList.length); i++){
        var d = (geomList[i][0]-fLat)**2 + (geomList[i][1]-fLng)**2;
        if(d < bestD){ bestD = d; si = i; }
      }
      var lLat = pts[pts.length-1][1], lLng = pts[pts.length-1][0];
      var ei = si; bestD = Infinity;
      for(var i = si; i < Math.min(si + 300, geomList.length); i++){
        var d = (geomList[i][0]-lLat)**2 + (geomList[i][1]-lLng)**2;
        if(d < bestD){ bestD = d; ei = i; }
      }
      for(var i = si; i <= ei; i++) ptLevels[i] = level;
      cursor = ei;
    });

    var midI = Math.floor(geomList.length / 2);
    var baseLat = geomList[midI][0], baseLng = geomList[midI][1];
    var cosLat = Math.cos(baseLat * Math.PI / 180);
    var DEG2M = 111320;
    var validElevs = elevSmooth.filter(e => e !== 0);
    var baseElev = validElevs.length ? Math.min(...validElevs) : 0;

    var minLat=90, maxLat=-90, minLng=180, maxLng=-180;
    geomList.forEach(p => {
      minLat = Math.min(minLat, p[0]); maxLat = Math.max(maxLat, p[0]);
      minLng = Math.min(minLng, p[1]); maxLng = Math.max(maxLng, p[1]);
    });

    var spanX = (maxLng - minLng) * DEG2M * cosLat;
    var spanY = (maxLat - minLat) * DEG2M;
    var span = Math.max(spanX, spanY, 100);
    var SCALE = 300 / span;
    var elevSpan = validElevs.length ? Math.max(...validElevs) - Math.min(...validElevs) : 100;
    var Z_EXG = Math.max(1.2, Math.min(2.5, span * 0.35 / Math.max(elevSpan, 1)));
    var Z_SCALE = SCALE * Z_EXG;

    var toXYZ = (lat, lng, elev) => [
      (lng - baseLng) * DEG2M * cosLat * SCALE,
      (lat - baseLat) * DEG2M * SCALE,
      (elev - baseElev) * Z_SCALE
    ];

    var BBOX_PAD = 8;
    var padLat = BBOX_PAD / (DEG2M * SCALE);
    var padLng = BBOX_PAD / (DEG2M * cosLat * SCALE);
    var gMinLat = minLat - padLat;
    var gMaxLat = maxLat + padLat;
    var gMinLng = minLng - padLng;
    var gMaxLng = maxLng + padLng;
    var GRID = 35;
    var gridPts = [];
    for(var j = 0; j < GRID; j++)
      for(var i = 0; i < GRID; i++)
        gridPts.push([
          gMinLat + (gMaxLat - gMinLat) * j / (GRID - 1),
          gMinLng + (gMaxLng - gMinLng) * i / (GRID - 1)
        ]);
    var gridElevs = await App.sampleElevations(gridPts, gridPts.length);

    var overlay = App.$("overlay3d");
    var W = window.innerWidth, H = window.innerHeight;

    var renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x101410);
    overlay.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 5000);
    camera.up.set(0, 0, 1);

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    var group = new THREE.Group();

    var roadMinZ = Infinity;
    for(var i = 0; i < geomList.length; i++){
      var z = ((elevSmooth[i] ?? 0) - baseElev) * Z_SCALE + 1.8;
      if(z < roadMinZ) roadMinZ = z;
    }

    var terrVerts = new Float32Array(GRID * GRID * 3);
    for(var i = 0; i < gridPts.length; i++){
      var [x, y, z] = toXYZ(gridPts[i][0], gridPts[i][1], gridElevs[i]);
      terrVerts[i*3] = x; terrVerts[i*3+1] = y; terrVerts[i*3+2] = Math.max(z, roadMinZ);
    }
    var terrIdx = [];
    for(var j = 0; j < GRID - 1; j++)
      for(var i = 0; i < GRID - 1; i++){
        var a = j * GRID + i;
        terrIdx.push(a, a+GRID, a+1, a+1, a+GRID, a+GRID+1);
      }
    var terrGeo = new THREE.BufferGeometry();
    terrGeo.setAttribute('position', new THREE.BufferAttribute(terrVerts, 3));
    terrGeo.setIndex(terrIdx);
    terrGeo.computeVertexNormals();
    var terrMat = new THREE.MeshStandardMaterial({
      color: 0x1f5a2a, roughness: .9, metalness: 0,
      transparent: true, opacity: .5, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    var terrMesh = new THREE.Mesh(terrGeo, terrMat);
    terrMesh.renderOrder = -1;
    group.add(terrMesh);
    var terrWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(terrGeo),
      new THREE.LineBasicMaterial({color: 0x3a7a4d, transparent: true, opacity: .08})
    );
    terrWire.renderOrder = -1;
    group.add(terrWire);

    // 地形スカート（bbox端の側面 + 底面）
    var skirtZ;
    {
      var skirtDrop = 8;
      skirtZ = roadMinZ - skirtDrop;
      var edges = [
        {start: 0, step: 1, count: GRID},
        {start: (GRID-1)*GRID, step: 1, count: GRID},
        {start: 0, step: GRID, count: GRID},
        {start: GRID-1, step: GRID, count: GRID},
      ];
      var skirtVerts = [];
      var skirtIdx = [];
      edges.forEach(edge => {
        for(var k = 0; k < edge.count - 1; k++){
          var i0 = edge.start + k * edge.step;
          var i1 = edge.start + (k+1) * edge.step;
          var ax = terrVerts[i0*3], ay = terrVerts[i0*3+1], az = terrVerts[i0*3+2];
          var bx = terrVerts[i1*3], by = terrVerts[i1*3+1], bz = terrVerts[i1*3+2];
          var base = skirtVerts.length / 3;
          skirtVerts.push(ax,ay,az, bx,by,bz, bx,by,skirtZ, ax,ay,skirtZ);
          skirtIdx.push(base,base+1,base+2, base,base+2,base+3);
        }
      });
      var sideGeo = new THREE.BufferGeometry();
      sideGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(skirtVerts), 3));
      sideGeo.setIndex(skirtIdx);
      sideGeo.computeVertexNormals();
      var sideMesh = new THREE.Mesh(sideGeo, new THREE.MeshStandardMaterial({
        color: 0x2d6b3a, roughness: .9, metalness: 0,
        transparent: true, opacity: .5, side: THREE.DoubleSide
      }));
      sideMesh.renderOrder = -1;
      group.add(sideMesh);
      // 底面
      var c0 = 0, c1 = GRID-1, c2 = (GRID-1)*GRID+GRID-1, c3 = (GRID-1)*GRID;
      var floorVerts = new Float32Array([
        terrVerts[c0*3],terrVerts[c0*3+1],skirtZ,
        terrVerts[c1*3],terrVerts[c1*3+1],skirtZ,
        terrVerts[c2*3],terrVerts[c2*3+1],skirtZ,
        terrVerts[c3*3],terrVerts[c3*3+1],skirtZ
      ]);
      var floorGeo = new THREE.BufferGeometry();
      floorGeo.setAttribute('position', new THREE.BufferAttribute(floorVerts, 3));
      floorGeo.setIndex([0,2,1, 0,3,2]);
      floorGeo.computeVertexNormals();
      var floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
        color: 0x2d6b3a, roughness: .9, metalness: 0,
        transparent: true, opacity: .1, side: THREE.DoubleSide
      }));
      floorMesh.renderOrder = -1;
      group.add(floorMesh);
    }

    // 道路中心線のXY座標（建物オフセット計算用）
    var roadXY = geomList.map(p => toXYZ(p[0], p[1], 0));
    var MIN_OFFSET = 5;

    // 建物ポリゴン（実ポリゴン座標 → 押し出しメッシュ、初期非表示）
    var bldgPolys = t.buildings || [];
    var bldgObjs = [];
    if(bldgPolys.length){
      var interpElev = (lat,lng)=>{
        var fx = (lng-gMinLng)/(gMaxLng-gMinLng)*(GRID-1);
        var fy = (lat-gMinLat)/(gMaxLat-gMinLat)*(GRID-1);
        var ix = Math.max(0,Math.min(GRID-2,Math.floor(fx)));
        var iy = Math.max(0,Math.min(GRID-2,Math.floor(fy)));
        var tx = fx-ix, ty = fy-iy;
        var e00=gridElevs[iy*GRID+ix], e10=gridElevs[iy*GRID+ix+1];
        var e01=gridElevs[(iy+1)*GRID+ix], e11=gridElevs[(iy+1)*GRID+ix+1];
        return e00*(1-tx)*(1-ty)+e10*tx*(1-ty)+e01*(1-tx)*ty+e11*tx*ty;
      };
      var BLDG_SCALE = Math.max(1, Math.min(5, 0.3 / SCALE));
      var BLDG_H = 4;
      var bldgMat = new THREE.MeshStandardMaterial({
        color:0xE8E8E8, roughness:.5, metalness:.15,
        emissive:0xCCDDEE, emissiveIntensity:.25
      });
      var bEdgeMat = new THREE.LineBasicMaterial({color:0x88AACC});
      bldgPolys.forEach(coords=>{
        var ring = coords;
        if(ring.length>1 && ring[0][0]===ring[ring.length-1][0] && ring[0][1]===ring[ring.length-1][1]) ring=ring.slice(0,-1);
        if(ring.length<3) return;
        var cLat=0, cLng=0;
        ring.forEach(c=>{ cLat+=c[0]; cLng+=c[1]; });
        cLat/=ring.length; cLng/=ring.length;
        var bElev = interpElev(cLat, cLng);
        var bz = (bElev - baseElev) * Z_SCALE;
        var rawCoords = ring.map(c => toXYZ(c[0], c[1], 0));
        var cx=0, cy=0;
        rawCoords.forEach(p => { cx+=p[0]; cy+=p[1]; });
        cx/=rawCoords.length; cy/=rawCoords.length;
        var sceneCoords = rawCoords.map(p => [
          cx + (p[0] - cx) * BLDG_SCALE,
          cy + (p[1] - cy) * BLDG_SCALE
        ]);
        // 道路との最小距離を確保
        var nearD = Infinity;
        for(var i=0;i<roadXY.length;i++){
          var d = Math.sqrt((roadXY[i][0]-cx)**2+(roadXY[i][1]-cy)**2);
          if(d<nearD) nearD=d;
        }
        var offX=0, offY=0;
        if(nearD < MIN_OFFSET){
          var nearI = roadXY.reduce((best,p,i)=>{
            var d=(p[0]-cx)**2+(p[1]-cy)**2;
            return d<best.d?{d,i}:best;
          },{d:Infinity,i:0}).i;
          var dx=cx-roadXY[nearI][0], dy=cy-roadXY[nearI][1];
          var dl=Math.sqrt(dx*dx+dy*dy)||1;
          offX=(dx/dl)*MIN_OFFSET-dx; offY=(dy/dl)*MIN_OFFSET-dy;
        }
        var shape = new THREE.Shape();
        shape.moveTo(sceneCoords[0][0]+offX, sceneCoords[0][1]+offY);
        for(var i=1;i<sceneCoords.length;i++) shape.lineTo(sceneCoords[i][0]+offX, sceneCoords[i][1]+offY);
        shape.closePath();
        var extGeo = new THREE.ExtrudeGeometry(shape, { depth: BLDG_H, bevelEnabled: false });
        var mesh = new THREE.Mesh(extGeo, bldgMat);
        mesh.position.set(0, 0, bz);
        mesh.visible = true;
        group.add(mesh);
        bldgObjs.push(mesh);
        var edges = new THREE.EdgesGeometry(extGeo);
        var eLine = new THREE.LineSegments(edges, bEdgeMat);
        eLine.position.copy(mesh.position);
        eLine.visible = true;
        group.add(eLine);
        bldgObjs.push(eLine);
      });
    }

    // 道路メッシュ（geometry_list + elevation_smooth直結、3d.jsと同じリボン方式）
    var ROAD_W = 1.0;
    var pts3 = geomList.map((p, i) => {
      var [x, y, z] = toXYZ(p[0], p[1], elevSmooth[i] ?? 0);
      return new THREE.Vector3(x, y, z + 1.8);
    });

    // 法線ベクトル（XY平面の垂線、道路を平坦に保つ）
    var normals = [];
    for(var i = 0; i < pts3.length - 1; i++){
      var dx = pts3[i+1].x - pts3[i].x, dy = pts3[i+1].y - pts3[i].y;
      var len = Math.sqrt(dx*dx + dy*dy) || 1;
      normals.push(new THREE.Vector3(-dy/len, dx/len, 0));
    }
    normals.push(normals[normals.length - 1].clone());
    // 隣接法線の平均で角のギザつきを軽減
    var smoothNormals = normals.map((n, i) => {
      if(i === 0 || i === normals.length - 1) return n;
      return new THREE.Vector3().addVectors(normals[i-1], normals[i]).normalize();
    });

    // 左端・右端・中央のポイント列
    var leftPts = pts3.map((p, i) => p.clone().addScaledVector(smoothNormals[i], -ROAD_W));
    var rightPts = pts3.map((p, i) => p.clone().addScaledVector(smoothNormals[i], ROAD_W));
    var centerPts = pts3.map(p => p.clone());
    if(App.isEndCloser(geomList, App.userLatLng?.[0], App.userLatLng?.[1])) centerPts.reverse();

    // 登り/下り判定（elevation_unevenness_sectionsから各ポイントに割り当て）
    var ELEV_HEX = { up:0xE8553D, down:0x4A90D9, flat:0x98989D };
    var ptElevDir = new Array(geomList.length).fill("flat");
    var eSecs = t.elevSections;
    if(eSecs){
      var assignDir = (sections, dir) => {
        sections.forEach(sec => {
          var si = 0, ei = geomList.length - 1, bestDs = Infinity, bestDe = Infinity;
          for(var i = 0; i < geomList.length; i++){
            var ds = (geomList[i][0]-sec.start[0])**2 + (geomList[i][1]-sec.start[1])**2;
            var de = (geomList[i][0]-sec.end[0])**2 + (geomList[i][1]-sec.end[1])**2;
            if(ds < bestDs){ bestDs = ds; si = i; }
            if(de < bestDe){ bestDe = de; ei = i; }
          }
          if(si > ei) [si, ei] = [ei, si];
          for(var i = si; i <= ei; i++) ptElevDir[i] = dir;
        });
      };
      assignDir(eSecs.uphill || [], "up");
      assignDir(eSecs.downhill || [], "down");
    }

    // 道路スラブジオメトリ（1メッシュ + 頂点カラー切替で高速化）
    var ROAD_T = 0.65;
    var N_PTS = pts3.length;
    var roadVerts = new Float32Array(N_PTS * 4 * 3);
    for(var j = 0; j < N_PTS; j++){
      var li = leftPts[j], ri = rightPts[j], o = j * 12;
      roadVerts[o]   = li.x; roadVerts[o+1] = li.y; roadVerts[o+2] = li.z;
      roadVerts[o+3] = ri.x; roadVerts[o+4] = ri.y; roadVerts[o+5] = ri.z;
      roadVerts[o+6] = li.x; roadVerts[o+7] = li.y; roadVerts[o+8] = li.z - ROAD_T;
      roadVerts[o+9] = ri.x; roadVerts[o+10]= ri.y; roadVerts[o+11]= ri.z - ROAD_T;
    }
    var roadIdx = [];
    var IDXS_PER_SEG = 24;
    for(var j = 0; j < N_PTS - 1; j++){
      var tl=j*4, tr=tl+1, bl=tl+2, br=tl+3;
      var ntl=(j+1)*4, ntr=ntl+1, nbl=ntl+2, nbr=ntl+3;
      roadIdx.push(tl,ntl,tr, tr,ntl,ntr, bl,br,nbl, br,nbr,nbl, tl,bl,ntl, ntl,bl,nbl, tr,ntr,br, br,ntr,nbr);
    }
    var roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(roadVerts, 3));
    roadGeo.setIndex(roadIdx);

    // 頂点カラー配列を生成（THREE.Colorでsrgb→linear変換）
    var tmpColor = new THREE.Color();
    function buildColorArray(levels, colorMap){
      var c = new Float32Array(N_PTS * 4 * 3);
      for(var j = 0; j < N_PTS; j++){
        tmpColor.set(colorMap[levels[j]] || 0x98989D);
        for(var k = 0; k < 4; k++){ var o = (j*4+k)*3; c[o]=tmpColor.r; c[o+1]=tmpColor.g; c[o+2]=tmpColor.b; }
      }
      return new THREE.BufferAttribute(c, 3);
    }

    // 勾配レベル判定
    var GRAD_HEX = { flat:0xB0B8C0, gentle:0x30D158, moderate:0xFF9F0A, steep:0xFF453A };
    var ptGradLevel = new Array(N_PTS).fill("flat");
    var elevSecsRaw = t.elevationSection || [];
    if(elevSecsRaw.length){
      var eN = elevSecsRaw.length;
      for(var k = 0; k < eN; k++){
        var si = Math.round(k * N_PTS / eN), ei = Math.round((k + 1) * N_PTS / eN);
        var level = elevSecsRaw[k].level;
        for(var i = si; i < ei && i < N_PTS; i++) ptGradLevel[i] = level;
      }
    }

    var roadColors = {
      corner: buildColorArray(ptLevels, LEVEL_HEX),
      elev: buildColorArray(ptElevDir, ELEV_HEX),
      gradient: buildColorArray(ptGradLevel, GRAD_HEX),
      off: buildColorArray(new Array(N_PTS).fill("white"), {white:0xB0B8C0})
    };
    roadGeo.setAttribute('color', roadColors.corner);
    roadGeo.computeVertexNormals();

    var roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide, depthTest: false, transparent: true
    }));
    roadMesh.renderOrder = 1;
    group.add(roadMesh);

    // トンネル・橋区間のインデックスを特定
    var ptIsTunnel = new Array(geomList.length).fill(false);
    var ptIsBridge = new Array(geomList.length).fill(false);
    var matchInfraSections = (sections, arr) => {
      (sections || []).forEach(sec => {
        if(!sec || sec.length < 2) return;
        var fLat = sec[0][0], fLng = sec[0][1];
        var lLat = sec[sec.length-1][0], lLng = sec[sec.length-1][1];
        var si = 0, ei = 0, bestDs = Infinity, bestDe = Infinity;
        for(var i = 0; i < geomList.length; i++){
          var ds = (geomList[i][0]-fLat)**2 + (geomList[i][1]-fLng)**2;
          var de = (geomList[i][0]-lLat)**2 + (geomList[i][1]-lLng)**2;
          if(ds < bestDs){ bestDs = ds; si = i; }
          if(de < bestDe){ bestDe = de; ei = i; }
        }
        if(si > ei) [si, ei] = [ei, si];
        for(var i = si; i <= ei; i++) arr[i] = true;
      });
    };
    matchInfraSections(t.tunnelSections, ptIsTunnel);
    matchInfraSections(t.bridgeSections, ptIsBridge);

    // トンネル: アーチ状の半円筒を道路上に描画
    var tunnelObjs = [];
    {
      var ARC_SEGS = 12;
      var T_RX = ROAD_W + 0.8;
      var T_RZ = (ROAD_W + 0.8) * 3.5;
      var tunnelMat = new THREE.MeshBasicMaterial({
        color: 0x505050,
        side: THREE.DoubleSide, transparent: true, opacity: 0.55,
        depthWrite: false, depthTest: false
      });
      var portalMat = new THREE.MeshBasicMaterial({
        color: 0x404040, side: THREE.DoubleSide,
        depthWrite: false, depthTest: false
      });
      var rs = 0;
      for(var i = 0; i <= pts3.length; i++){
        if(i < pts3.length && ptIsTunnel[i] === ptIsTunnel[rs]) continue;
        if(ptIsTunnel[rs]){
          var end = Math.min(i, pts3.length - 1);
          var n = end - rs + 1;
          if(n >= 2){
            var vertsPerRing = ARC_SEGS + 1;
            var verts = new Float32Array(n * vertsPerRing * 3);
            for(var j = 0; j < n; j++){
              var c = pts3[rs + j];
              var norm = smoothNormals[rs + j];
              var ARC_START = Math.PI * 0.15;
              var ARC_END = Math.PI * 0.85;
              var zOff = Math.sin(ARC_START) * T_RZ;
              for(var k = 0; k <= ARC_SEGS; k++){
                var angle = ARC_START + (ARC_END - ARC_START) * k / ARC_SEGS;
                var across = Math.cos(angle) * T_RX;
                var up = Math.sin(angle) * T_RZ - zOff;
                var vi = (j * vertsPerRing + k) * 3;
                verts[vi]   = c.x + norm.x * across;
                verts[vi+1] = c.y + norm.y * across;
                verts[vi+2] = c.z + up;
              }
            }
            var idx = [];
            for(var j = 0; j < n - 1; j++){
              for(var k = 0; k < ARC_SEGS; k++){
                var a = j * vertsPerRing + k;
                var b = a + 1;
                var c2 = a + vertsPerRing;
                var d = c2 + 1;
                idx.push(a, c2, b, b, c2, d);
              }
            }
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            var mesh = new THREE.Mesh(geo, tunnelMat);
            mesh.renderOrder = 10;
            tunnelObjs.push(mesh);
            group.add(mesh);

            // ポータル（入口・出口の半円面）
            for(var pi of [rs, end]){
              var pc = pts3[pi];
              var pn = smoothNormals[pi];
              var P_ARC_START = Math.PI * 0.15;
              var P_ARC_END = Math.PI * 0.85;
              var pZOff = Math.sin(P_ARC_START) * T_RZ;
              var pv = new Float32Array((ARC_SEGS + 2) * 3);
              pv[0] = pc.x; pv[1] = pc.y; pv[2] = pc.z + T_RZ * 0.5 - pZOff;
              for(var k = 0; k <= ARC_SEGS; k++){
                var angle = P_ARC_START + (P_ARC_END - P_ARC_START) * k / ARC_SEGS;
                var vi = (k + 1) * 3;
                pv[vi]   = pc.x + pn.x * Math.cos(angle) * T_RX;
                pv[vi+1] = pc.y + pn.y * Math.cos(angle) * T_RX;
                pv[vi+2] = pc.z + Math.sin(angle) * T_RZ - pZOff;
              }
              var pIdx = [];
              for(var k = 0; k < ARC_SEGS; k++) pIdx.push(0, k + 1, k + 2);
              var pGeo = new THREE.BufferGeometry();
              pGeo.setAttribute('position', new THREE.BufferAttribute(pv, 3));
              pGeo.setIndex(pIdx);
              pGeo.computeVertexNormals();
              var pMesh = new THREE.Mesh(pGeo, portalMat);
              pMesh.renderOrder = 10;
              tunnelObjs.push(pMesh);
              group.add(pMesh);
            }
          }
        }
        rs = i;
      }
    }

    // テレイン高さ補間（シーン座標 x,y → 地表Z）
    var terrainZ = (sx, sy) => {
      var gx0 = terrVerts[0], gy0 = terrVerts[1];
      var gx1 = terrVerts[(GRID*GRID-1)*3], gy1 = terrVerts[(GRID*GRID-1)*3+1];
      var spanX = gx1 - gx0, spanY = gy1 - gy0;
      if(!spanX || !spanY) return skirtZ;
      var fi = (sx - gx0) / spanX * (GRID - 1);
      var fj = (sy - gy0) / spanY * (GRID - 1);
      var i0 = Math.max(0, Math.min(GRID-2, Math.floor(fi)));
      var j0 = Math.max(0, Math.min(GRID-2, Math.floor(fj)));
      var fx = fi - i0, fy = fj - j0;
      var idx = (r,c) => (r * GRID + c) * 3 + 2;
      var z00 = terrVerts[idx(j0, i0)], z10 = terrVerts[idx(j0, i0+1)];
      var z01 = terrVerts[idx(j0+1, i0)], z11 = terrVerts[idx(j0+1, i0+1)];
      return z00*(1-fx)*(1-fy) + z10*fx*(1-fy) + z01*(1-fx)*fy + z11*fx*fy;
    };

    // 橋: コンクリート床版 + 低いガードレール + 橋脚（テレインまで）
    var bridgeObjs = [];
    {
      var DECK_T = 0.8;
      var DECK_TOP = -0.15;
      var GUARD_H = 1.5;
      var RAIL_T = 0.15;
      var POST_INTERVAL = 2;
      var PIER_THICK = 0.6;
      var concMat = new THREE.MeshBasicMaterial({color: 0x686460, side: THREE.DoubleSide});
      var guardMat = new THREE.MeshBasicMaterial({color: 0x888278, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false});
      var addObj = (o) => { if(o.material === guardMat) o.renderOrder = 10; bridgeObjs.push(o); group.add(o); };

      // 道路端に沿った板メッシュ
      var buildSlab = (sidePts, startIdx, count, zBot, zTop, mat) => {
        var v = new Float32Array(count * 2 * 3);
        for(var j = 0; j < count; j++){
          var sp = sidePts[startIdx + j];
          v[j*6]   = sp.x; v[j*6+1] = sp.y; v[j*6+2] = sp.z + zBot;
          v[j*6+3] = sp.x; v[j*6+4] = sp.y; v[j*6+5] = sp.z + zTop;
        }
        var idx = [];
        for(var j = 0; j < count - 1; j++){
          var a=j*2, b=a+1, c=a+2, d=c+1;
          idx.push(a,c,b, b,c,d);
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        addObj(new THREE.Mesh(geo, mat));
      };

      var rs = 0;
      for(var i = 0; i <= pts3.length; i++){
        if(i < pts3.length && ptIsBridge[i] === ptIsBridge[rs]) continue;
        if(ptIsBridge[rs]){
          var end = Math.min(i, pts3.length - 1);
          var n = end - rs + 1;
          if(n >= 2){
            // 左右側面（DECK_TOPで道路面より少し下げてZ-fighting回避）
            for(var sidePts of [leftPts, rightPts]){
              buildSlab(sidePts, rs, n, -DECK_T, DECK_TOP, concMat);
            }

            // 左右ガードレール（柵: 横バー2段 + 縦ポスト）
            for(var side of [leftPts, rightPts]){
              for(var hRatio of [1.0, 0.5]){
                var barH = GUARD_H * hRatio;
                buildSlab(side, rs, n, barH - RAIL_T, barH + RAIL_T, guardMat);
              }
              for(var j = 0; j < n; j += POST_INTERVAL){
                var sp = side[rs + j];
                var norm = smoothNormals[rs + j];
                var pv = new Float32Array(4 * 3);
                pv[0] = sp.x + norm.x*RAIL_T; pv[1] = sp.y + norm.y*RAIL_T; pv[2] = sp.z;
                pv[3] = sp.x - norm.x*RAIL_T; pv[4] = sp.y - norm.y*RAIL_T; pv[5] = sp.z;
                pv[6] = sp.x + norm.x*RAIL_T; pv[7] = sp.y + norm.y*RAIL_T; pv[8] = sp.z + GUARD_H + RAIL_T;
                pv[9] = sp.x - norm.x*RAIL_T; pv[10]= sp.y - norm.y*RAIL_T; pv[11]= sp.z + GUARD_H + RAIL_T;
                var pGeo = new THREE.BufferGeometry();
                pGeo.setAttribute('position', new THREE.BufferAttribute(pv, 3));
                pGeo.setIndex([0,2,1, 1,2,3]);
                pGeo.computeVertexNormals();
                addObj(new THREE.Mesh(pGeo, guardMat));
              }
            }

            // 始点・終点の端面キャップ（DECK_TOPと揃える）
            for(var ci of [rs, end]){
              var li = leftPts[ci], ri = rightPts[ci];
              var cv = new Float32Array(4 * 3);
              cv[0]=li.x; cv[1]=li.y; cv[2]=li.z - DECK_T;
              cv[3]=ri.x; cv[4]=ri.y; cv[5]=ri.z - DECK_T;
              cv[6]=li.x; cv[7]=li.y; cv[8]=li.z + DECK_TOP;
              cv[9]=ri.x; cv[10]=ri.y; cv[11]=ri.z + DECK_TOP;
              var cGeo = new THREE.BufferGeometry();
              cGeo.setAttribute('position', new THREE.BufferAttribute(cv, 3));
              cGeo.setIndex([0,1,2, 2,1,3]);
              cGeo.computeVertexNormals();
              addObj(new THREE.Mesh(cGeo, concMat));
            }

            // 橋脚（先頭・末尾に1本ずつ、長い方の高さに揃える）
            var pA = pts3[rs], pB = pts3[end];
            var gzA = terrainZ(pA.x, pA.y), gzB = terrainZ(pB.x, pB.y);
            var hA = pA.z - DECK_T - gzA, hB = pB.z - DECK_T - gzB;
            var pH = Math.max(hA, hB, 0.5);
            for(var ji of [rs, end]){
              var li = leftPts[ji], ri = rightPts[ji];
              var p = pts3[ji];
              // 橋の中心方向を計算（rsなら→end方向、endなら→rs方向）
              var other = (ji === rs) ? Math.min(rs + 1, end) : Math.max(end - 1, rs);
              var op = pts3[other];
              var tdx = op.x - p.x, tdy = op.y - p.y;
              var tLen = Math.sqrt(tdx*tdx + tdy*tdy) || 1;
              var tx = tdx/tLen, ty = tdy/tLen;
              var topZ = p.z - DECK_T;
              var botZ = topZ - pH;
              // 橋脚は端面から内側にだけ伸ばす（外にはみ出さない）
              var pv = new Float32Array(8 * 3);
              pv[0] =li.x;              pv[1] =li.y;              pv[2] =topZ;
              pv[3] =ri.x;              pv[4] =ri.y;              pv[5] =topZ;
              pv[6] =li.x+tx*PIER_THICK; pv[7] =li.y+ty*PIER_THICK; pv[8] =topZ;
              pv[9] =ri.x+tx*PIER_THICK; pv[10]=ri.y+ty*PIER_THICK; pv[11]=topZ;
              pv[12]=li.x;              pv[13]=li.y;              pv[14]=botZ;
              pv[15]=ri.x;              pv[16]=ri.y;              pv[17]=botZ;
              pv[18]=li.x+tx*PIER_THICK; pv[19]=li.y+ty*PIER_THICK; pv[20]=botZ;
              pv[21]=ri.x+tx*PIER_THICK; pv[22]=ri.y+ty*PIER_THICK; pv[23]=botZ;
              var pIdx = [
                0,2,1, 1,2,3,
                4,5,6, 5,7,6,
                0,1,4, 1,5,4,
                2,6,3, 3,6,7,
                0,4,2, 2,4,6,
                1,3,5, 3,7,5
              ];
              var pGeo = new THREE.BufferGeometry();
              pGeo.setAttribute('position', new THREE.BufferAttribute(pv, 3));
              pGeo.setIndex(pIdx);
              pGeo.computeVertexNormals();
              addObj(new THREE.Mesh(pGeo, concMat));
            }
          }
        }
        rs = i;
      }
    }

    // 縁線
    var edgeMat = new THREE.LineBasicMaterial({color: 0x333333, depthTest: false, transparent: true});
    var leftEdge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftPts), edgeMat);
    var rightEdge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightPts), edgeMat.clone());
    leftEdge.renderOrder = 11; rightEdge.renderOrder = 11;
    group.add(leftEdge);
    group.add(rightEdge);
    // 中央線（破線）
    var centerMat = new THREE.LineDashedMaterial({color: 0x666666, dashSize: 2, gapSize: 1.5, depthTest: false, transparent: true});
    var centerLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(centerPts), centerMat);
    centerLine.renderOrder = 11;
    centerLine.computeLineDistances();
    group.add(centerLine);

    // 補助線（bboxフレーム + 道路から上方向への垂直線）
    {
      var rMinX=Infinity,rMaxX=-Infinity,rMinY=Infinity,rMaxY=-Infinity,rMinZ=Infinity,rMaxZ=-Infinity;
      pts3.forEach(p=>{
        rMinX=Math.min(rMinX,p.x);rMaxX=Math.max(rMaxX,p.x);
        rMinY=Math.min(rMinY,p.y);rMaxY=Math.max(rMaxY,p.y);
        rMinZ=Math.min(rMinZ,p.z);rMaxZ=Math.max(rMaxZ,p.z);
      });
      var pad = BBOX_PAD;
      rMinX-=pad;rMaxX+=pad;rMinY-=pad;rMaxY+=pad;


      var dashMat = new THREE.LineDashedMaterial({
        color:0xaaaaaa, dashSize:3, gapSize:2, transparent:true, opacity:.45,
        depthTest:false
      });
      var addDash = (points) => {
        var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), dashMat.clone());
        line.computeLineDistances();
        group.add(line);
      };

      // bbox底面
      addDash([
        new THREE.Vector3(rMinX,rMinY,skirtZ), new THREE.Vector3(rMaxX,rMinY,skirtZ),
        new THREE.Vector3(rMaxX,rMaxY,skirtZ), new THREE.Vector3(rMinX,rMaxY,skirtZ),
        new THREE.Vector3(rMinX,rMinY,skirtZ)
      ]);
      // bbox上面
      addDash([
        new THREE.Vector3(rMinX,rMinY,rMaxZ), new THREE.Vector3(rMaxX,rMinY,rMaxZ),
        new THREE.Vector3(rMaxX,rMaxY,rMaxZ), new THREE.Vector3(rMinX,rMaxY,rMaxZ),
        new THREE.Vector3(rMinX,rMinY,rMaxZ)
      ]);
      // bbox4隅の垂直線
      [[rMinX,rMinY],[rMaxX,rMinY],[rMaxX,rMaxY],[rMinX,rMaxY]].forEach(([x,y])=>{
        addDash([new THREE.Vector3(x,y,skirtZ), new THREE.Vector3(x,y,rMaxZ)]);
      });

      // 道路ポイントから交互に上・下方向への垂直線（実距離kmベースの間隔）
      var intervalKm = t.lengthKm < 3 ? 0.5 : t.lengthKm < 10 ? 1 : 2;
      var intervalM = intervalKm * 1000;
      var accumM = 0;
      var lastVertM = -intervalM;
      var vertUp = true;
      for(var i = 0; i < geomList.length; i++){
        if(i > 0){
          var dy = (geomList[i][0] - geomList[i-1][0]) * DEG2M;
          var dx = (geomList[i][1] - geomList[i-1][1]) * DEG2M * cosLat;
          accumM += Math.sqrt(dx*dx + dy*dy);
        }
        if(accumM - lastVertM >= intervalM){
          var p = pts3[i];
          if(vertUp) addDash([new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(p.x, p.y, rMaxZ)]);
          else addDash([new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(p.x, p.y, skirtZ)]);
          vertUp = !vertUp;
          lastVertM = accumM;
        }
      }
      var last = pts3[pts3.length - 1];
      if(vertUp) addDash([new THREE.Vector3(last.x, last.y, last.z), new THREE.Vector3(last.x, last.y, rMaxZ)]);
      else addDash([new THREE.Vector3(last.x, last.y, last.z), new THREE.Vector3(last.x, last.y, skirtZ)]);

      // 最低点→上、最高点→下
      var minZi = 0, maxZi = 0;
      pts3.forEach((p,i)=>{ if(p.z < pts3[minZi].z) minZi = i; if(p.z > pts3[maxZi].z) maxZi = i; });
      var pLow = pts3[minZi], pHigh = pts3[maxZi];
      addDash([new THREE.Vector3(pLow.x, pLow.y, pLow.z), new THREE.Vector3(pLow.x, pLow.y, rMaxZ)]);
      addDash([new THREE.Vector3(pHigh.x, pHigh.y, pHigh.z), new THREE.Vector3(pHigh.x, pHigh.y, skirtZ)]);

      // 寸法ラベル（10m単位に丸め）
      var round10 = v => Math.round(v / 10) * 10;
      var realW = round10((maxLng - minLng) * DEG2M * cosLat);
      var realD = round10((maxLat - minLat) * DEG2M);
      var realH = round10(validElevs.length ? Math.max(...validElevs) - Math.min(...validElevs) : 0);
      function makeLabelSprite(num){
        var cv = document.createElement('canvas');
        var cx = cv.getContext('2d');
        var numStr = num.toLocaleString();
        cx.font = '40px sans-serif';
        var nw = cx.measureText(numStr).width;
        cx.font = '26px sans-serif';
        var uw = cx.measureText('m').width;
        cv.width = nw + uw + 16; cv.height = 52;
        cx.textBaseline = 'middle';
        cx.fillStyle = 'rgba(255,255,255,.25)';
        cx.font = '40px sans-serif';
        cx.fillText(numStr, 8, cv.height / 2);
        cx.font = '26px sans-serif';
        cx.fillText('m', 8 + nw + 1, cv.height / 2);
        var tex = new THREE.CanvasTexture(cv);
        var mat = new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false});
        var sp = new THREE.Sprite(mat);
        sp.scale.set(cv.width / 8, cv.height / 8, 1);
        return sp;
      }
      // 横幅（底面X辺の中央）
      var lblW = makeLabelSprite(realW);
      lblW.position.set((rMinX+rMaxX)/2, rMinY - 3, rMinZ);
      group.add(lblW);
      // 奥行き（底面Y辺の中央）
      var lblD = makeLabelSprite(realD);
      lblD.position.set(rMaxX + 3, (rMinY+rMaxY)/2, rMinZ);
      group.add(lblD);
      // 高さ（垂直辺の中央）
      var lblH = makeLabelSprite(realH);
      lblH.position.set(rMinX - 3, rMinY, (rMinZ+rMaxZ)/2);
      group.add(lblH);

      // 底面に道路の影（投影線）
      var floorPts = pts3.map(p => new THREE.Vector3(p.x, p.y, skirtZ));
      var floorLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(floorPts),
        new THREE.LineDashedMaterial({color:0x666666, dashSize:2, gapSize:1.5, transparent:true, opacity:.15, depthTest:false})
      );
      floorLine.computeLineDistances();
      group.add(floorLine);
    }

    // 赤丸（道路上を走るオブジェクト）
    var sphere = new THREE.Mesh(
      new THREE.SphereGeometry(3, 16, 16),
      new THREE.MeshBasicMaterial({color: 0xff0000, depthTest: false, transparent: true})
    );
    sphere.renderOrder = 20;
    group.add(sphere);

    var floorW = rMaxX - rMinX, floorH = rMaxY - rMinY;
    var floorGeo = new THREE.PlaneGeometry(floorW, floorH);
    var floorMat = new THREE.MeshStandardMaterial({color:0x222222, side: THREE.DoubleSide});
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set((rMinX+rMaxX)/2, (rMinY+rMaxY)/2, skirtZ);
    group.add(floor);

    // bboxフレームの実寸（ラベル等を含まない）
    var frameCenter = new THREE.Vector3((rMinX+rMaxX)/2, (rMinY+rMaxY)/2, (skirtZ+rMaxZ)/2);
    var frameSize = new THREE.Vector3(rMaxX-rMinX, rMaxY-rMinY, rMaxZ-skirtZ);

    var bbox = new THREE.Box3().setFromObject(group);
    var center = bbox.getCenter(new THREE.Vector3());
    group.position.sub(center);
    frameCenter.sub(center);
    scene.add(group);

    controls.target.set(0, 0, 0);
    var size = bbox.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);

    // FOV+アスペクト比からモデル全体が収まるカメラ距離を算出
    var aspect = W / H;
    var vFov = camera.fov * Math.PI / 180;
    var hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    var fitFov = Math.min(vFov, hFov);
    var fitDist = (maxDim / 2) / Math.tan(fitFov / 2) * 0.9;

    // 進行方向の背後にあるbbox隅にカメラを配置
    var cdx = centerPts[centerPts.length - 1].x - centerPts[0].x;
    var cdy = centerPts[centerPts.length - 1].y - centerPts[0].y;
    var fCorners = [
      [frameCenter.x - frameSize.x/2, frameCenter.y - frameSize.y/2],
      [frameCenter.x + frameSize.x/2, frameCenter.y - frameSize.y/2],
      [frameCenter.x - frameSize.x/2, frameCenter.y + frameSize.y/2],
      [frameCenter.x + frameSize.x/2, frameCenter.y + frameSize.y/2]
    ];
    var bestCorner = fCorners[0], bestDot = -Infinity;
    fCorners.forEach(function(c){ var dot = -cdx*c[0] + -cdy*c[1]; if(dot > bestDot){ bestDot = dot; bestCorner = c; } });
    var bcl = Math.sqrt(bestCorner[0]*bestCorner[0] + bestCorner[1]*bestCorner[1]) || 1;
    var camH = fitDist * 0.95;
    var initCamX = bestCorner[0]/bcl * camH, initCamY = bestCorner[1]/bcl * camH, initCamZ = fitDist * 0.35;
    camera.position.set(initCamX, initCamY, initCamZ);

    controls.update();

    scene.add(new THREE.HemisphereLight(0xdde8f0, 0x0a1a0a, 0.5));
    var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(fitDist * 0.5, fitDist * 0.5, fitDist * 1.2);
    scene.add(dirLight);

    // 道路・縁線を即表示
    sphere.visible = true;

    // 赤丸アニメーション（実距離ベースの一定速度）
    var progress = 0;
    var totalPts = centerPts.length;
    var pathLen = 0;
    for(var i = 1; i < totalPts; i++) pathLen += centerPts[i].distanceTo(centerPts[i-1]);
    var SPEED = 2.2;
    var progressPerFrame = pathLen > 0 ? SPEED / pathLen : 0.005;

    var animId;
    var lastTime = performance.now();
    var animate = (now) => {
      animId = requestAnimationFrame(animate);
      var dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      controls.update();

      // 赤丸移動
      progress += progressPerFrame;
      if(progress > 1) progress = 0;
      var idx = Math.floor(progress * (totalPts - 1));
      var next = Math.min(idx + 1, totalPts - 1);
      var frac = (progress * (totalPts - 1)) % 1;
      sphere.position.lerpVectors(centerPts[idx], centerPts[next], frac);
      sphere.position.z += 3;

      renderer.render(scene, camera);
    };
    animate(performance.now());

    var onResize = () => {
      var w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    var legend3d = App.$("legend3d");
    var cornerLegend = '<span><i style="background:#FF453A"></i>低速コーナー</span><span><i style="background:#FF9F0A"></i>中速</span><span><i style="background:#30D158"></i>高速</span><span><i style="background:#98989D"></i>ストレート</span>';
    var elevLegend = '<span><i style="background:#E8553D"></i>登り</span><span><i style="background:#4A90D9"></i>下り</span><span><i style="background:#98989D"></i>平坦</span>';
    var gradLegend = '<span><i style="background:#FF453A"></i>急(7%+)</span><span><i style="background:#FF9F0A"></i>中(3-7%)</span><span><i style="background:#30D158"></i>緩(1-3%)</span><span><i style="background:#B0B8C0"></i>平(0-1%)</span>';

    // 道路表示の状態管理: "corner" | "elev" | "gradient" | "off"
    var roadColorMode = "corner";
    legend3d.innerHTML = cornerLegend;

    function updateRoadVisibility(){
      roadGeo.setAttribute('color', roadColors[roadColorMode] || roadColors.corner);
      roadGeo.attributes.color.needsUpdate = true;
      legend3d.innerHTML = roadColorMode === "corner" ? cornerLegend : roadColorMode === "elev" ? elevLegend : roadColorMode === "gradient" ? gradLegend : "";
    }

    // セクション色トグル
    var secBtn = App.$("toggle3dSection");
    var toggleBtn = App.$("toggle3dColor");
    var gradBtn = App.$("toggle3dGradient");

    function updateToggleBtnStates(){
      secBtn.classList.toggle("active", roadColorMode === "corner");
      toggleBtn.classList.toggle("active", roadColorMode === "elev");
      gradBtn.classList.toggle("active", roadColorMode === "gradient");
    }

    secBtn.onclick = ()=>{
      roadColorMode = roadColorMode === "corner" ? "off" : "corner";
      updateToggleBtnStates();
      updateRoadVisibility();
    };

    if(eSecs){
      toggleBtn.style.display = "";
      toggleBtn.onclick = ()=>{
        roadColorMode = roadColorMode === "elev" ? "corner" : "elev";
        updateToggleBtnStates();
        updateRoadVisibility();
      };
    }else{
      toggleBtn.style.display = "none";
    }

    gradBtn.onclick = ()=>{
      roadColorMode = roadColorMode === "gradient" ? "corner" : "gradient";
      updateToggleBtnStates();
      updateRoadVisibility();
    };

    // トンネル/橋トグル（3Dオブジェクトの表示/非表示）
    var hasInfra = tunnelObjs.length > 0 || bridgeObjs.length > 0;
    var infraBtn = App.$("toggle3dInfra");
    infraBtn.style.display = "";
    var infraVisible = hasInfra;
    infraBtn.classList.toggle("active", infraVisible);
    infraBtn.onclick = ()=>{
      infraVisible = !infraVisible;
      tunnelObjs.forEach(o => o.visible = infraVisible);
      bridgeObjs.forEach(o => o.visible = infraVisible);
      infraBtn.classList.toggle("active", infraVisible);
    };

    // 建物トグル
    var bldgBtn = App.$("toggle3dBuildings");
    if(bldgObjs.length){
      bldgBtn.style.display = "";
      var bldgVisible = true;
      bldgBtn.classList.add("active");
      bldgBtn.onclick = ()=>{
        bldgVisible = !bldgVisible;
        bldgObjs.forEach(o => o.visible = bldgVisible);
        bldgBtn.classList.toggle("active", bldgVisible);
      };
    }else{
      bldgBtn.style.display = "none";
    }

    var printBtn = App.$("toggle3dPrint");
    var isAdmin3d = localStorage.getItem("touge.admin") === "true" || localStorage.getItem("speedio_admin") === "1";
    if(isAdmin3d){
      printBtn.style.display = "";
      printBtn.onclick = ()=> App.openPrintView(t);
    }else{
      printBtn.style.display = "none";
    }

    var paramsEl = App.$("params3d");
    if(isAdmin3d){
      var sc = v => { var n = (v ?? 0); return n >= 0.7 ? "hi" : n >= 0.4 ? "mid" : "lo"; };
      var scCorner = v => { var n = (v ?? 0); return n >= 0.2 ? "hi" : n >= 0.1 ? "mid" : n <= 0.05 ? "lo" : ""; };
      var scNone = v => { var n = (v ?? 0); return n <= 0.05 ? "hi" : n <= 0.1 ? "mid" : n >= 0.2 ? "lo" : ""; };
      var sv = (v, fn) => { var n = (v ?? 0); return `<span class="${fn(n)}">${n.toFixed(3)}</span>`; };
      var row = (label, v) => `<dt title="${label}">${label}</dt><dd>${sv(v, sc)}</dd>`;
      var rowC = (label, v) => `<dt title="${label}">${label}</dt><dd>${sv(v, scCorner)}</dd>`;
      var rowN = (label, v) => `<dt title="${label}">${label}</dt><dd>${sv(v, scNone)}</dd>`;
      paramsEl.innerHTML = `<div class="overlay-3d-params-titlebar">
          <span class="overlay-3d-params-title">📊 パラメーター</span>
          <button class="overlay-3d-params-minimize" id="toggleParams3d" title="最小化">─</button>
        </div>
        <div class="overlay-3d-params-body" id="paramsBody3d">
        <h4>score</h4>
        <dl>
          ${row("score_width", t.scoreWidth)}
          ${row("score_claude_center_line_section", t.scoreClaudeCenterLineSection)}
          ${row("score_elevation_unevenness", t.scoreElevationUnevenness)}
          ${row("score_corner_balance", t.scoreCornerBalance)}
          ${row("score_length", t.scoreLength)}
          ${row("score_building", t.scoreBuilding)}
          ${row("score_tunnel_outside", t.scoreTunnelOutside)}
        </dl>
        <h4>score_elevation</h4>
        <dl>
          ${rowC("score_elevation", t.scoreElevation)}
        </dl>
        <h4>score_corner</h4>
        <dl>
          ${rowC("score_corner_strong", t.scoreCornerStrong)}
          ${rowC("score_corner_medium", t.scoreCornerMedium)}
          ${rowC("score_corner_week", t.scoreCornerWeek)}
          ${rowC("score_corner_none", t.scoreCornerNone)}
        </dl>
        <dd style="text-align:right;margin:2px 0 0;color:rgba(255,255,255,.5);font-size:10px">= ${(t.scoreCornerStrong + t.scoreCornerMedium + t.scoreCornerWeek + t.scoreCornerNone).toFixed(3)}</dd>
        <h4>basic</h4>
        <dl>
          <dt>length</dt><dd>${t.lengthKm} km</dd>
          <dt>elevation_height</dt><dd>${t.height} m</dd>
          <dt>building_nearby_cnt</dt><dd>${t.buildingCnt ?? "-"} 個</dd>
          <dt title="building_density">building_density</dt><dd>${t.buildingDensity != null ? t.buildingDensity + " km" : "-"}</dd>
          <dt title="elevation_unevenness_count">elevation_unevenness_count</dt><dd>${t.unevennessCount ?? "-"} 回</dd>
          <dt>uphill_cnt</dt><dd>${t.uphillCnt ?? "-"} 回</dd>
          <dt>downhill_cnt</dt><dd>${t.downhillCnt ?? "-"} 回</dd>
        </dl></div>`;
      App.$("toggleParams3d").onclick = () => {
        var min = paramsEl.classList.toggle("minimized");
        App.$("toggleParams3d").textContent = min ? "□" : "─";
        App.$("toggleParams3d").title = min ? "復元" : "最小化";
      };
      paramsEl.classList.add("minimized");
      paramsEl.classList.add("show");
      App.$("toggleParams3d").textContent = "□";
      App.$("toggleParams3d").title = "復元";
    }else{
      paramsEl.classList.remove("show");
      paramsEl.innerHTML = "";
    }

    active3D = {renderer, scene, animId, onResize};

    // BBox面カメラプリセット
    {
      var setCamFace = (posDir, upVec, faceW, faceH, depth, target) => {
        controls.autoRotate = false;
        controls.maxPolarAngle = Math.PI;
        var dV = (faceH / 2) / Math.tan(vFov / 2);
        var dH = (faceW / 2) / Math.tan(hFov / 2);
        var d = Math.max(dV, dH) + depth / 2;
        camera.up.copy(upVec);
        camera.position.copy(posDir).normalize().multiplyScalar(d).add(target);
        controls.target.copy(target);
        controls.update();
      };
      var topCandidates = [[0,1],[0,-1],[1,0],[-1,0]];
      var topBest = topCandidates[0], topBestDot = -Infinity;
      topCandidates.forEach(function(c){ var dot = cdx*c[0] + cdy*c[1]; if(dot > topBestDot){ topBestDot = dot; topBest = c; } });
      var topUpX = topBest[0] === 0;
      App.$("cam3dTop").onclick = () => { progress = 0; setCamFace(
        new THREE.Vector3(0, 0, 1), new THREE.Vector3(topBest[0], topBest[1], 0),
        topUpX ? frameSize.x : frameSize.y, topUpX ? frameSize.y : frameSize.x,
        frameSize.z, frameCenter
      ); };
      App.$("cam3dSide").onclick = () => { progress = 0; setCamFace(
        frameSize.x >= frameSize.y
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        Math.max(frameSize.x, frameSize.y), frameSize.z,
        Math.min(frameSize.x, frameSize.y), frameCenter
      ); };
      App.$("cam3dReset").onclick = () => {
        progress = 0;
        controls.autoRotate = true;
        controls.maxPolarAngle = Math.PI / 2.05;
        camera.up.set(0, 0, 1);
        camera.position.set(initCamX, initCamY, initCamZ);
        controls.target.set(0, 0, 0);
        controls.update();
      };
    }

    var maxE = validElevs.length ? Math.round(Math.max(...validElevs)) : 0;
    var minE = validElevs.length ? Math.round(Math.min(...validElevs)) : 0;
    App.$("info3d").innerHTML = `<b>${App.escapeHtml(t.name)}</b><br>全長 ${t.lengthKm}km ・ 標高 ${minE}〜${maxE}m（差 ${maxE - minE}m）`;
    overlay.classList.add("show");
  }catch(err){
    console.error("[3D]", err);
    App.toast("3D表示に失敗しました");
  }finally{
    App.showLoading(false);
  }
}

App.close3DView = function(){
  if(!active3D) return;
  cancelAnimationFrame(active3D.animId);
  window.removeEventListener('resize', active3D.onResize);
  active3D.scene.traverse(obj => {
    obj.geometry?.dispose();
    if(obj.material){
      if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  active3D.renderer.dispose();
  active3D.renderer.domElement.remove();
  App.$("params3d").classList.remove("show");
  App.$("params3d").innerHTML = "";
  App.$("overlay3d").classList.remove("show");
  active3D = null;
}

App.has3DActive = function(){ return !!active3D; };

App.init3D = function(){
  (window.requestIdleCallback||function(cb){setTimeout(cb,200)})(function(){loadThreeJS()}, {timeout:5000});
  App.$("close3d").addEventListener("click", App.close3DView);
};
