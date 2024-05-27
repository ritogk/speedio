import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.164.1/examples/jsm/controls/OrbitControls.js";

export const draw3D = (coordinates, elevations) => {
  const width = 1800;
  const height = 1100;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  document.getElementById("road3DArea").appendChild(renderer.domElement);
  // Z軸が上になるようにカメラの向きを設定
  camera.up.set(0, 0, 1);
  camera.position.set(200, 200, 100); // Z軸を真上から見る。
  camera.lookAt(0, 0, 0); // 原点を見る

  const axesHelper = new THREE.AxesHelper(100); // 軸の長さを指定
  scene.add(axesHelper);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;

  // 描画処理
  const centerIndex = Math.floor(coordinates.length / 2 - 1);
  const baseX = coordinates[centerIndex][0]; // 0番目の座標を基準に
  const baseY = coordinates[centerIndex][1]; // 0番目の座標を基準に
  const baseZ = elevations[centerIndex]; // 0番目の座標を基準に
  const points = coordinates.map((coord, index) => {
    const x = (coord[1] - baseY) / 10; // coordinates[0]のX座標を基準に
    const y = (coord[0] - baseX) / 10; // coordinates[0]のY座標を基準に
    const z = (elevations[index] - baseZ) / 6;
    return new THREE.Vector3(x, y, z);
  });

  const offsetDistance = 1; // オフセット距離
  let normalVectors = [];

  for (let i = 0; i < points.length - 1; i++) {
    let p1 = points[i];
    let p2 = points[i + 1];
    let direction = new THREE.Vector3().subVectors(p2, p1).normalize();
    let normal = new THREE.Vector3(-direction.y, direction.x, 0);
    normalVectors.push(normal);
  }

  // 最後の法線ベクトルは一つ前のものを使用
  normalVectors.push(normalVectors[normalVectors.length - 1]);

  const offsetPoints = points.map((point, index) => {
    return new THREE.Vector3().addVectors(
      point,
      normalVectors[index].multiplyScalar(offsetDistance)
    );
  });

  // 平面を生成する
  const vertices = [];
  points.forEach((point, index) => vertices.push(point.x, point.y, point.z));
  offsetPoints.forEach((point, index) =>
    vertices.push(point.x, point.y, point.z)
  );

  const faces = [];
  for (let i = 0; i < points.length - 1; i++) {
    const n = points.length;
    // 下面の三角形
    faces.push(i, i + n, i + 1);
    // 上面の三角形
    faces.push(i + 1, i + n, i + n + 1);
  }

  // 平面ジオメトリの作成
  const geometry = new THREE.BufferGeometry();

  const verticesFloat32 = new Float32Array(vertices);
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(verticesFloat32, 3)
  );
  const indicesUint16 = new Uint16Array(faces);
  geometry.setIndex(new THREE.BufferAttribute(indicesUint16, 1));

  const material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    color: 0xdbdcdc,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // エッジの描画
  const edges = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xaaacaa })
  );

  // シーンへの追加
  scene.add(line);

  const maxZIndex = elevations.indexOf(Math.max(...elevations));
  const minZIndex = elevations.indexOf(Math.min(...elevations));
  const maxZPoint = points[maxZIndex];
  const minZPoint = points[minZIndex];
  function addVerticalLineToZero(point, scene, color) {
    const material = new THREE.LineBasicMaterial({ color: color });
    const points = [];
    points.push(new THREE.Vector3(point.x, point.y, point.z));
    points.push(new THREE.Vector3(point.x, point.y, 0));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
  }

  function addLineToOriginFromZero(point, scene, color) {
    const material = new THREE.LineBasicMaterial({ color: color });
    const points = [];
    points.push(new THREE.Vector3(point.x, point.y, 0));
    points.push(new THREE.Vector3(0, 0, 0));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
  }

  addVerticalLineToZero(maxZPoint, scene, 0xff00ff);
  // addLineToOriginFromZero(maxZPoint, scene, 0x00ff00);
  addVerticalLineToZero(minZPoint, scene, 0xffff00);
  // addLineToOriginFromZero(minZPoint, scene, 0x00ff00); // 緑色

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
    // x座標に対して回転
    scene.rotation.z += 0.01;
    renderer.render(scene, camera);
  }

  animate();
};
