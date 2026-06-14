<script setup lang="ts">
// 峠の3Dオーバーレイ表示。Three.jsで地形・道路・建物をレンダリングする。
import { onUnmounted, ref, watch } from "vue";

import type {
  Material,
  Mesh,
  Object3D,
  Scene,
  Sprite,
  Vector3,
  WebGLRenderer,
} from "three";

import { dem } from "@/lib/dem";
import { useToast } from "@/composables/useToast";
import { useTougeStore } from "@/stores/tougeStore";
import type { TougeVM } from "@/types/touge";

const store = useTougeStore();
const { show: toast } = useToast();

const canvasContainer = ref<HTMLElement | null>(null);
const infoHtml = ref("");
const showToggle = ref(false);
const showBuildingToggle = ref(false);
const sectionVisible = ref(true);
const buildingsVisible = ref(false);
const toggleLabel = ref("登り/下り");
const legendItems = ref<{ color: string; label: string }[]>([]);
const preparing = ref(false);

// Three.js active state
let active: {
  renderer: WebGLRenderer;
  scene: Scene;
  animId: number;
  onResize: () => void;
  cornerMeshes: Mesh[];
  elevMeshes: Mesh[];
  whiteMeshes: Mesh[];
  elevMode: boolean;
  bldgObjs: Object3D[];
} | null = null;

const CORNER_LEGEND = [
  { color: "#FF453A", label: "低速コーナー" },
  { color: "#FF9F0A", label: "中速" },
  { color: "#30D158", label: "高速" },
  { color: "#98989D", label: "ストレート" },
];

const ELEV_LEGEND = [
  { color: "#E8553D", label: "登り" },
  { color: "#4A90D9", label: "下り" },
  { color: "#98989D", label: "平坦" },
];

const close = () => {
  store.close3D();
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") close();
};

const updateRoadVisibility = () => {
  if (!active) return;
  const sv = sectionVisible.value;
  const em = active.elevMode;
  active.cornerMeshes.forEach((m) => { m.visible = sv && !em; });
  active.elevMeshes.forEach((m) => { m.visible = sv && em; });
  active.whiteMeshes.forEach((m) => { m.visible = !sv; });
  legendItems.value = sv ? (em ? ELEV_LEGEND : CORNER_LEGEND) : [];
};

const toggleSection = () => {
  if (!active) return;
  sectionVisible.value = !sectionVisible.value;
  updateRoadVisibility();
};

const toggleColorMode = () => {
  if (!active) return;
  active.elevMode = !active.elevMode;
  if (!sectionVisible.value) { sectionVisible.value = true; }
  toggleLabel.value = active.elevMode ? "コーナー" : "登り/下り";
  updateRoadVisibility();
};

const toggleBuildings = () => {
  if (!active) return;
  buildingsVisible.value = !buildingsVisible.value;
  active.bldgObjs.forEach((o) => {
    o.visible = buildingsVisible.value;
  });
};

const cleanup = () => {
  if (!active) return;
  cancelAnimationFrame(active.animId);
  window.removeEventListener("resize", active.onResize);
  active.scene.traverse((obj: Object3D) => {
    const mesh = obj as Mesh;
    mesh.geometry?.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material))
        mesh.material.forEach((m: Material) => m.dispose());
      else (mesh.material as Material).dispose();
    }
  });
  active.renderer.dispose();
  active.renderer.domElement.remove();
  active = null;
};

const open3DView = async (t: TougeVM) => {
  cleanup();
  preparing.value = true;
  try {
    const THREE = await import("three");
    const { OrbitControls } = await import(
      "three/addons/controls/OrbitControls.js"
    );

    const geomList = t.poly;
    const elevSmooth = t.elevationSmooth || [];
    if (geomList.length < 2 || elevSmooth.length < 2) {
      preparing.value = false;
      return;
    }

    const LEVEL_HEX: Record<string, number> = {
      strong: 0xff453a,
      medium: 0xff9f0a,
      weak: 0x30d158,
      straight: 0x98989d,
      none: 0x98989d,
    };

    // geometry_list + elevation_smooth 直結 (1:1)
    // road_section のコーナーレベルを順方向マッチングで割り当て
    const ptLevels = new Array(geomList.length).fill("straight") as string[];
    let cursor = 0;
    const roadSecs = t.roadSection || [];
    roadSecs.forEach((sec) => {
      const pts = sec.points || [];
      if (pts.length < 2) return;
      const level =
        sec.section_type === "straight"
          ? "straight"
          : sec.corner_level || "weak";
      const fLat = pts[0][1],
        fLng = pts[0][0];
      let si = cursor,
        bestD = Infinity;
      for (let i = cursor; i < Math.min(cursor + 150, geomList.length); i++) {
        const d =
          (geomList[i][0] - fLat) ** 2 + (geomList[i][1] - fLng) ** 2;
        if (d < bestD) {
          bestD = d;
          si = i;
        }
      }
      const lLat = pts[pts.length - 1][1],
        lLng = pts[pts.length - 1][0];
      let ei = si;
      bestD = Infinity;
      for (let i = si; i < Math.min(si + 300, geomList.length); i++) {
        const d =
          (geomList[i][0] - lLat) ** 2 + (geomList[i][1] - lLng) ** 2;
        if (d < bestD) {
          bestD = d;
          ei = i;
        }
      }
      for (let i = si; i <= ei; i++) ptLevels[i] = level;
      cursor = ei;
    });

    const midI = Math.floor(geomList.length / 2);
    const baseLat = geomList[midI][0],
      baseLng = geomList[midI][1];
    const cosLat = Math.cos((baseLat * Math.PI) / 180);
    const DEG2M = 111320;
    const validElevs = elevSmooth.filter((e) => e !== 0);
    const baseElev = validElevs.length ? Math.min(...validElevs) : 0;

    let minLat = 90,
      maxLat = -90,
      minLng = 180,
      maxLng = -180;
    geomList.forEach((p) => {
      minLat = Math.min(minLat, p[0]);
      maxLat = Math.max(maxLat, p[0]);
      minLng = Math.min(minLng, p[1]);
      maxLng = Math.max(maxLng, p[1]);
    });

    const spanX = (maxLng - minLng) * DEG2M * cosLat;
    const spanY = (maxLat - minLat) * DEG2M;
    const span = Math.max(spanX, spanY, 100);
    const SCALE = 300 / span;
    const elevSpan = validElevs.length
      ? Math.max(...validElevs) - Math.min(...validElevs)
      : 100;
    const Z_EXG = Math.max(
      1.5,
      Math.min(5, (span * 0.35) / Math.max(elevSpan, 1)),
    );
    const Z_SCALE = SCALE * Z_EXG;

    const toXYZ = (lat: number, lng: number, elev: number): [number, number, number] => [
      (lng - baseLng) * DEG2M * cosLat * SCALE,
      (lat - baseLat) * DEG2M * SCALE,
      (elev - baseElev) * Z_SCALE,
    ];

    // 地形グリッド (35x35)
    const PAD_RATIO = 0.2;
    const gMinLat = minLat - (maxLat - minLat) * PAD_RATIO;
    const gMaxLat = maxLat + (maxLat - minLat) * PAD_RATIO;
    const gMinLng = minLng - (maxLng - minLng) * PAD_RATIO;
    const gMaxLng = maxLng + (maxLng - minLng) * PAD_RATIO;
    const GRID = 35;
    const gridPts: [number, number][] = [];
    for (let j = 0; j < GRID; j++)
      for (let i = 0; i < GRID; i++)
        gridPts.push([
          gMinLat + ((gMaxLat - gMinLat) * j) / (GRID - 1),
          gMinLng + ((gMaxLng - gMinLng) * i) / (GRID - 1),
        ]);
    const gridElevs = await dem.sampleElevations(gridPts, gridPts.length);

    const container = canvasContainer.value;
    if (!container) return;
    const W = window.innerWidth,
      H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x101410);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 5000);
    camera.up.set(0, 0, 1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;

    const group = new THREE.Group();

    // 地形メッシュ
    const terrVerts = new Float32Array(GRID * GRID * 3);
    for (let i = 0; i < gridPts.length; i++) {
      const [x, y, z] = toXYZ(gridPts[i][0], gridPts[i][1], gridElevs[i]);
      terrVerts[i * 3] = x;
      terrVerts[i * 3 + 1] = y;
      terrVerts[i * 3 + 2] = z;
    }
    const terrIdx: number[] = [];
    for (let j = 0; j < GRID - 1; j++)
      for (let i = 0; i < GRID - 1; i++) {
        const a = j * GRID + i;
        terrIdx.push(a, a + GRID, a + 1, a + 1, a + GRID, a + GRID + 1);
      }
    const terrGeo = new THREE.BufferGeometry();
    terrGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(terrVerts, 3),
    );
    terrGeo.setIndex(terrIdx);
    terrGeo.computeVertexNormals();
    group.add(
      new THREE.Mesh(
        terrGeo,
        new THREE.MeshStandardMaterial({
          color: 0x2d6b3a,
          roughness: 0.9,
          metalness: 0,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
        }),
      ),
    );
    group.add(
      new THREE.LineSegments(
        new THREE.WireframeGeometry(terrGeo),
        new THREE.LineBasicMaterial({
          color: 0x3a7a4d,
          transparent: true,
          opacity: 0.08,
        }),
      ),
    );

    // 建物ポリゴン
    const bldgPolys = t.buildings || [];
    const bldgObjs: Object3D[] = [];
    if (bldgPolys.length) {
      const interpElev = (lat: number, lng: number) => {
        const fx =
          ((lng - gMinLng) / (gMaxLng - gMinLng)) * (GRID - 1);
        const fy =
          ((lat - gMinLat) / (gMaxLat - gMinLat)) * (GRID - 1);
        const ix = Math.max(0, Math.min(GRID - 2, Math.floor(fx)));
        const iy = Math.max(0, Math.min(GRID - 2, Math.floor(fy)));
        const tx = fx - ix,
          ty = fy - iy;
        const e00 = gridElevs[iy * GRID + ix],
          e10 = gridElevs[iy * GRID + ix + 1];
        const e01 = gridElevs[(iy + 1) * GRID + ix],
          e11 = gridElevs[(iy + 1) * GRID + ix + 1];
        return (
          e00 * (1 - tx) * (1 - ty) +
          e10 * tx * (1 - ty) +
          e01 * (1 - tx) * ty +
          e11 * tx * ty
        );
      };
      const BLDG_H = 6;
      const bldgMat = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.5,
        metalness: 0.15,
        emissive: 0xccddee,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const bEdgeMat = new THREE.LineBasicMaterial({
        color: 0x88aacc,
        transparent: true,
        opacity: 0.5,
      });
      bldgPolys.forEach((coords) => {
        let ring = coords;
        if (
          ring.length > 1 &&
          ring[0][0] === ring[ring.length - 1][0] &&
          ring[0][1] === ring[ring.length - 1][1]
        )
          ring = ring.slice(0, -1);
        if (ring.length < 3) return;
        let cLat = 0,
          cLng = 0;
        ring.forEach((c) => {
          cLat += c[0];
          cLng += c[1];
        });
        cLat /= ring.length;
        cLng /= ring.length;
        const bElev = interpElev(cLat, cLng);
        const shape = new THREE.Shape();
        const fp = ring.map((c) => toXYZ(c[0], c[1], 0));
        shape.moveTo(fp[0][0], fp[0][1]);
        for (let i = 1; i < fp.length; i++) shape.lineTo(fp[i][0], fp[i][1]);
        try {
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: BLDG_H * Z_SCALE,
            bevelEnabled: false,
          });
          const mesh = new THREE.Mesh(geo, bldgMat);
          mesh.position.z = (bElev - baseElev) * Z_SCALE + 0.15;
          mesh.visible = false;
          group.add(mesh);
          bldgObjs.push(mesh);
          const edges = new THREE.EdgesGeometry(geo);
          const eLine = new THREE.LineSegments(edges, bEdgeMat);
          eLine.position.z = mesh.position.z;
          eLine.visible = false;
          group.add(eLine);
          bldgObjs.push(eLine);
        } catch {
          // invalid geometry
        }
      });
    }

    // 道路メッシュ (リボン方式)
    const ROAD_W = 1.5;
    const pts3 = geomList.map((p, i) => {
      const [x, y, z] = toXYZ(p[0], p[1], elevSmooth[i] ?? 0);
      return new THREE.Vector3(x, y, z + 0.3);
    });

    // 法線ベクトル (XY平面の垂線)
    const normals: Vector3[] = [];
    for (let i = 0; i < pts3.length - 1; i++) {
      const dx = pts3[i + 1].x - pts3[i].x,
        dy = pts3[i + 1].y - pts3[i].y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      normals.push(new THREE.Vector3(-dy / len, dx / len, 0));
    }
    normals.push(normals[normals.length - 1].clone());
    const smoothNormals = normals.map((n, i) => {
      if (i === 0 || i === normals.length - 1) return n;
      return new THREE.Vector3()
        .addVectors(normals[i - 1], normals[i])
        .normalize();
    });

    const leftPts = pts3.map((p, i) =>
      p.clone().addScaledVector(smoothNormals[i], -ROAD_W),
    );
    const rightPts = pts3.map((p, i) =>
      p.clone().addScaledVector(smoothNormals[i], ROAD_W),
    );
    const centerPts = pts3.map((p) => p.clone());

    // 登り/下り判定
    const ELEV_HEX: Record<string, number> = {
      up: 0xe8553d,
      down: 0x4a90d9,
      flat: 0x98989d,
    };
    const ptElevDir = new Array(geomList.length).fill("flat") as string[];
    const eSecs = t.elevSections;
    if (eSecs) {
      const assignDir = (
        sections: { start: [number, number]; end: [number, number] }[],
        dir: string,
      ) => {
        sections.forEach((sec) => {
          let si = 0,
            ei = geomList.length - 1,
            bestDs = Infinity,
            bestDe = Infinity;
          for (let i = 0; i < geomList.length; i++) {
            const ds =
              (geomList[i][0] - sec.start[0]) ** 2 +
              (geomList[i][1] - sec.start[1]) ** 2;
            const de =
              (geomList[i][0] - sec.end[0]) ** 2 +
              (geomList[i][1] - sec.end[1]) ** 2;
            if (ds < bestDs) {
              bestDs = ds;
              si = i;
            }
            if (de < bestDe) {
              bestDe = de;
              ei = i;
            }
          }
          if (si > ei) [si, ei] = [ei, si];
          for (let i = si; i <= ei; i++) ptElevDir[i] = dir;
        });
      };
      assignDir(eSecs.uphill || [], "up");
      assignDir(eSecs.downhill || [], "down");
    }

    // リボンメッシュ生成
    const buildRoadMeshes = (
      levels: string[],
      colorMap: Record<string, number>,
    ): Mesh[] => {
      const meshes: Mesh[] = [];
      let rs = 0;
      for (let i = 0; i <= pts3.length; i++) {
        if (i < pts3.length && levels[i] === levels[rs]) continue;
        const end = Math.min(i, pts3.length - 1);
        const n = end - rs + 1;
        if (n >= 2) {
          const verts = new Float32Array(n * 2 * 3);
          for (let j = 0; j < n; j++) {
            const li = leftPts[rs + j],
              ri = rightPts[rs + j];
            verts[j * 6] = li.x;
            verts[j * 6 + 1] = li.y;
            verts[j * 6 + 2] = li.z;
            verts[j * 6 + 3] = ri.x;
            verts[j * 6 + 4] = ri.y;
            verts[j * 6 + 5] = ri.z;
          }
          const idx: number[] = [];
          for (let j = 0; j < n - 1; j++) {
            const a = j * 2,
              b = j * 2 + 1,
              c = (j + 1) * 2,
              d = (j + 1) * 2 + 1;
            idx.push(a, c, b, b, c, d);
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute(
            "position",
            new THREE.BufferAttribute(verts, 3),
          );
          geo.setIndex(idx);
          geo.computeVertexNormals();
          meshes.push(
            new THREE.Mesh(
              geo,
              new THREE.MeshBasicMaterial({
                color: colorMap[levels[rs]] || 0x98989d,
                side: THREE.DoubleSide,
              }),
            ),
          );
        }
        rs = i;
      }
      return meshes;
    };

    const cornerMeshes = buildRoadMeshes(ptLevels, LEVEL_HEX);
    const elevMeshes = buildRoadMeshes(ptElevDir, ELEV_HEX);
    const whiteLevels = new Array(geomList.length).fill("white") as string[];
    const whiteMeshes = buildRoadMeshes(whiteLevels, { white: 0xb0b8c0 });
    cornerMeshes.forEach((m) => group.add(m));
    elevMeshes.forEach((m) => {
      m.visible = false;
      group.add(m);
    });
    whiteMeshes.forEach((m) => {
      m.visible = false;
      m.material.polygonOffset = true;
      m.material.polygonOffsetFactor = 1;
      m.material.polygonOffsetUnits = 1;
      group.add(m);
    });

    // 縁線
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x595959 });
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(leftPts),
        edgeMat,
      ),
    );
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(rightPts),
        edgeMat.clone(),
      ),
    );
    // 中央線 (破線)
    const centerMat = new THREE.LineDashedMaterial({
      color: 0x595959,
      dashSize: 2,
      gapSize: 1.5,
    });
    const centerLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(centerPts),
      centerMat,
    );
    centerLine.computeLineDistances();
    group.add(centerLine);

    // 補助線 (bboxフレーム + 垂直線)
    {
      let rMinX = Infinity,
        rMaxX = -Infinity,
        rMinY = Infinity,
        rMaxY = -Infinity,
        rMinZ = Infinity,
        rMaxZ = -Infinity;
      pts3.forEach((p) => {
        rMinX = Math.min(rMinX, p.x);
        rMaxX = Math.max(rMaxX, p.x);
        rMinY = Math.min(rMinY, p.y);
        rMaxY = Math.max(rMaxY, p.y);
        rMinZ = Math.min(rMinZ, p.z);
        rMaxZ = Math.max(rMaxZ, p.z);
      });
      const pad = 8;
      rMinX -= pad;
      rMaxX += pad;
      rMinY -= pad;
      rMaxY += pad;

      const dashMat = new THREE.LineDashedMaterial({
        color: 0xaaaaaa,
        dashSize: 3,
        gapSize: 2,
        transparent: true,
        opacity: 0.45,
        depthTest: false,
      });
      const addDash = (points: Vector3[]) => {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          dashMat.clone(),
        );
        line.computeLineDistances();
        group.add(line);
      };

      // bbox底面
      addDash([
        new THREE.Vector3(rMinX, rMinY, rMinZ),
        new THREE.Vector3(rMaxX, rMinY, rMinZ),
        new THREE.Vector3(rMaxX, rMaxY, rMinZ),
        new THREE.Vector3(rMinX, rMaxY, rMinZ),
        new THREE.Vector3(rMinX, rMinY, rMinZ),
      ]);
      // bbox上面
      addDash([
        new THREE.Vector3(rMinX, rMinY, rMaxZ),
        new THREE.Vector3(rMaxX, rMinY, rMaxZ),
        new THREE.Vector3(rMaxX, rMaxY, rMaxZ),
        new THREE.Vector3(rMinX, rMaxY, rMaxZ),
        new THREE.Vector3(rMinX, rMinY, rMaxZ),
      ]);
      // bbox4隅の垂直線
      (
        [
          [rMinX, rMinY],
          [rMaxX, rMinY],
          [rMaxX, rMaxY],
          [rMinX, rMaxY],
        ] as [number, number][]
      ).forEach(([x, y]) => {
        addDash([
          new THREE.Vector3(x, y, rMinZ),
          new THREE.Vector3(x, y, rMaxZ),
        ]);
      });

      // 道路ポイントから垂直線 (実距離ベースの間隔)
      const intervalKm = t.lengthKm < 3 ? 0.5 : t.lengthKm < 10 ? 1 : 2;
      const intervalM = intervalKm * 1000;
      let accumM = 0;
      let lastVertM = -intervalM;
      let vertUp = true;
      for (let i = 0; i < geomList.length; i++) {
        if (i > 0) {
          const dy = (geomList[i][0] - geomList[i - 1][0]) * DEG2M;
          const dx =
            (geomList[i][1] - geomList[i - 1][1]) * DEG2M * cosLat;
          accumM += Math.sqrt(dx * dx + dy * dy);
        }
        if (accumM - lastVertM >= intervalM) {
          const p = pts3[i];
          if (vertUp)
            addDash([
              new THREE.Vector3(p.x, p.y, p.z),
              new THREE.Vector3(p.x, p.y, rMaxZ),
            ]);
          else
            addDash([
              new THREE.Vector3(p.x, p.y, p.z),
              new THREE.Vector3(p.x, p.y, rMinZ),
            ]);
          vertUp = !vertUp;
          lastVertM = accumM;
        }
      }
      const last = pts3[pts3.length - 1];
      if (vertUp)
        addDash([
          new THREE.Vector3(last.x, last.y, last.z),
          new THREE.Vector3(last.x, last.y, rMaxZ),
        ]);
      else
        addDash([
          new THREE.Vector3(last.x, last.y, last.z),
          new THREE.Vector3(last.x, last.y, rMinZ),
        ]);

      // 最低点・最高点
      let minZi = 0,
        maxZi = 0;
      pts3.forEach((p, i) => {
        if (p.z < pts3[minZi].z) minZi = i;
        if (p.z > pts3[maxZi].z) maxZi = i;
      });
      const pLow = pts3[minZi],
        pHigh = pts3[maxZi];
      addDash([
        new THREE.Vector3(pLow.x, pLow.y, pLow.z),
        new THREE.Vector3(pLow.x, pLow.y, rMaxZ),
      ]);
      addDash([
        new THREE.Vector3(pHigh.x, pHigh.y, pHigh.z),
        new THREE.Vector3(pHigh.x, pHigh.y, rMinZ),
      ]);

      // 寸法ラベル (10m単位に丸め)
      const round10 = (v: number) => Math.round(v / 10) * 10;
      const realW = round10((maxLng - minLng) * DEG2M * cosLat);
      const realD = round10((maxLat - minLat) * DEG2M);
      const realH = round10(
        validElevs.length
          ? Math.max(...validElevs) - Math.min(...validElevs)
          : 0,
      );
      const makeLabelSprite = (num: number): Sprite => {
        const cv = document.createElement("canvas");
        const cx = cv.getContext("2d")!;
        const numStr = num.toLocaleString();
        cx.font = "40px sans-serif";
        const nw = cx.measureText(numStr).width;
        cx.font = "26px sans-serif";
        const uw = cx.measureText("m").width;
        cv.width = nw + uw + 16;
        cv.height = 52;
        cx.textBaseline = "middle";
        cx.fillStyle = "rgba(255,255,255,.25)";
        cx.font = "40px sans-serif";
        cx.fillText(numStr, 8, cv.height / 2);
        cx.font = "26px sans-serif";
        cx.fillText("m", 8 + nw + 1, cv.height / 2);
        const tex = new THREE.CanvasTexture(cv);
        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
        });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(cv.width / 8, cv.height / 8, 1);
        return sp;
      };
      const lblW = makeLabelSprite(realW);
      lblW.position.set((rMinX + rMaxX) / 2, rMinY - 3, rMinZ);
      group.add(lblW);
      const lblD = makeLabelSprite(realD);
      lblD.position.set(rMaxX + 3, (rMinY + rMaxY) / 2, rMinZ);
      group.add(lblD);
      const lblH = makeLabelSprite(realH);
      lblH.position.set(rMinX - 3, rMinY, (rMinZ + rMaxZ) / 2);
      group.add(lblH);

      // 底面に道路の影
      const floorPts = pts3.map(
        (p) => new THREE.Vector3(p.x, p.y, rMinZ),
      );
      const floorLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(floorPts),
        new THREE.LineDashedMaterial({
          color: 0x666666,
          dashSize: 2,
          gapSize: 1.5,
          transparent: true,
          opacity: 0.15,
          depthTest: false,
        }),
      );
      floorLine.computeLineDistances();
      group.add(floorLine);
    }

    // 赤丸 (道路上を走るオブジェクト)
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(4, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    );
    group.add(sphere);

    const bbox = new THREE.Box3().setFromObject(group);
    const center = bbox.getCenter(new THREE.Vector3());
    group.position.sub(center);
    scene.add(group);

    controls.target.set(0, 0, 0);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 0.6, maxDim * 0.8, maxDim * 0.6);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xc8d8e8, 0x1a2a1a, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(maxDim * 0.5, maxDim * 0.5, maxDim * 1.2);
    scene.add(dirLight);

    // 赤丸アニメーション
    let progress = 0;
    const totalPts = centerPts.length;
    let pathLen = 0;
    for (let i = 1; i < totalPts; i++)
      pathLen += centerPts[i].distanceTo(centerPts[i - 1]);
    const SPEED = 2.2;
    const progressPerFrame = pathLen > 0 ? SPEED / pathLen : 0.005;

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      group.rotation.z += 0.0008;

      progress += progressPerFrame;
      if (progress > 1) progress = 0;
      const idx = Math.floor(progress * (totalPts - 1));
      const next = Math.min(idx + 1, totalPts - 1);
      const frac = (progress * (totalPts - 1)) % 1;
      sphere.position.lerpVectors(centerPts[idx], centerPts[next], frac);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = window.innerWidth,
        h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // 色切替ボタン
    if (eSecs) {
      showToggle.value = true;
      toggleLabel.value = "登り/下り";
    } else {
      showToggle.value = false;
    }
    legendItems.value = CORNER_LEGEND;

    // トグル初期化
    sectionVisible.value = true;
    showBuildingToggle.value = bldgObjs.length > 0;
    buildingsVisible.value = false;

    active = {
      renderer,
      scene,
      animId,
      onResize,
      cornerMeshes,
      elevMeshes,
      whiteMeshes,
      elevMode: false,
      bldgObjs,
    };

    const maxE = validElevs.length
      ? Math.round(Math.max(...validElevs))
      : 0;
    const minE = validElevs.length
      ? Math.round(Math.min(...validElevs))
      : 0;
    infoHtml.value = `<b>${escapeHtml(t.name)}</b><br>全長 ${t.lengthKm}km ・ 標高 ${minE}〜${maxE}m（差 ${maxE - minE}m）`;
  } catch (err) {
    console.error("[3D]", err);
    toast("3D表示に失敗しました");
  } finally {
    preparing.value = false;
  }
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

watch(
  () => store.overlay3dTarget,
  (touge) => {
    if (touge) {
      open3DView(touge);
    } else {
      cleanup();
    }
  },
);

onUnmounted(() => {
  cleanup();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.overlay3dTarget"
      class="overlay-3d"
      @keydown="onKeydown"
    >
      <!-- Loading spinner during preparation -->
      <div v-if="preparing" class="overlay-3d-preparing">
        <div class="spinner"></div>
        <p>3Dデータを準備中...</p>
      </div>

      <!-- HUD -->
      <div class="overlay-3d-hud">
        <button class="overlay-3d-close" @click="close">&#x2715;</button>
        <div class="overlay-3d-info" v-html="infoHtml"></div>
      </div>

      <!-- Toggle buttons (right-top, vertical) -->
      <div class="overlay-3d-tools">
        <button
          class="overlay-3d-toggle"
          :class="{ active: sectionVisible }"
          @click="toggleSection"
        >
          セクション
        </button>
        <button
          v-if="showToggle"
          class="overlay-3d-toggle"
          :class="{ active: active?.elevMode }"
          @click="toggleColorMode"
        >
          {{ toggleLabel }}
        </button>
        <button
          v-if="showBuildingToggle"
          class="overlay-3d-toggle"
          :class="{ active: buildingsVisible }"
          @click="toggleBuildings"
        >
          &#x1F3E0; 建物
        </button>
      </div>

      <!-- Canvas container -->
      <div ref="canvasContainer" class="overlay-3d-canvas"></div>

      <!-- Legend -->
      <div class="overlay-3d-legend">
        <span v-for="item in legendItems" :key="item.label">
          <i :style="{ background: item.color }"></i>{{ item.label }}
        </span>
      </div>

      <!-- Hint -->
      <div class="overlay-3d-hint">
        1本指で回転 ・ 2本指で移動/ズーム
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay-3d {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #101410;
  display: flex;
  flex-direction: column;
}

.overlay-3d-canvas {
  flex: 1;
  min-height: 0;
}

.overlay-3d-canvas :deep(canvas) {
  display: block;
}

.overlay-3d-preparing {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  background: rgba(0, 0, 0, 0.55);
}

.overlay-3d-preparing .spinner {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  animation: spin 1s linear infinite;
}

.overlay-3d-preparing p {
  color: #fff;
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.overlay-3d-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(rgba(0, 0, 0, 0.65), transparent);
  pointer-events: none;
}

.overlay-3d-hud > * {
  pointer-events: auto;
}

.overlay-3d-close {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-3d-close:hover {
  background: rgba(255, 255, 255, 0.15);
}

.overlay-3d-tools {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overlay-3d-toggle {
  flex-shrink: 0;
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  padding: 6px 14px;
  white-space: nowrap;
}

.overlay-3d-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
}

.overlay-3d-toggle.active {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.6);
}

.overlay-3d-info {
  color: #fff;
  font-size: 13px;
  line-height: 1.6;
}

.overlay-3d-info :deep(b) {
  font-weight: 700;
}

.overlay-3d-hint {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
}

.overlay-3d-legend {
  position: absolute;
  bottom: 50px;
  left: 14px;
  z-index: 10;
  font-size: 11px;
  color: #fff;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overlay-3d-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.overlay-3d-legend i {
  width: 14px;
  height: 4px;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
}
</style>
