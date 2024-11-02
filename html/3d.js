import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.164.1/examples/jsm/controls/OrbitControls.js";

export const draw3D = async (
  coordinates,
  elevations,
  terrain_elevation_path
) => {
  console.log(terrain_elevation_path);
  /**
   * JSONファイルを読み込む
   */
  async function loadJson(path) {
    const response = await fetch(path);
    const data = await response.json();
    return data;
  }

  /**
   * レンダラーを生成
   */
  const generateRenderer = (width, height) => {
    const renderer = new THREE.WebGLRenderer();
    renderer.shadowMap.enabled = true; // 影を有効化
    renderer.setSize(width, height);
    document.body.appendChild(renderer.domElement);
    return renderer;
  };

  /**
   * シーンを生成
   */
  const generateScene = () => {
    const scence = new THREE.Scene();
    // scence.fog = new THREE.Fog(0x000000, 50, 800); // 霧を追加
    return scence;
  };

  /**
   * カメラを生成
   */
  const generateCamera = (renderer, width, height) => {
    // カメラを作成(視野角, アスペクト比, near, far(広角.30くらいで望遠。90で広角))
    // nearとfarの範囲をレンダリングするのでパーフォマンスを上げるために適切な値を設定する。
    const camera = new THREE.PerspectiveCamera(50, width / height, 10, 1000);
    // カメラ位置
    camera.up.set(0, 0, 1);
    // camera.position.set(0, 0, 400); // Z軸を真上から見る。
    camera.position.set(200, 400, 400); // Z軸を真上から見る。
    // camera.lookAt(0, 0, 0); // 原点を見る

    // // OrbitControlsを追加して、カメラをマウス操作で回転させる
    // const cameraControls = new OrbitControls(camera, renderer.domElement);
    // cameraControls.enableDamping = true; // 慣性効果
    // cameraControls.dampingFactor = 0.05;
    // cameraControls.screenSpacePanning = false;
    // cameraControls.maxPolarAngle = Math.PI / 2; // 上向きすぎるのを防ぐ

    return { camera };
  };

  /**
   * 道路メッシュを生成
   */
  const generateRoadMesh = (elevations, coordinates, baseX, baseY, baseZ) => {
    const roadColor = 0xbfbfbf;
    const sideLineColor = 0x595959;
    const centerLineColor = 0x595959;
    const offsetDistance = 1.5; // 道幅のオフセット距離

    const points = coordinates.map((coord, index) => {
      const x = (coord[1] - baseY) / 10; // coordinates[0]のX座標を基準に
      const y = (coord[0] - baseX) / 10; // coordinates[0]のY座標を基準に
      const z = (elevations[index] - baseZ) / 6;
      return new THREE.Vector3(x, y, z);
    });

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

    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      color: roadColor,
    });
    const roadMesh = new THREE.Mesh(geometry, material);

    // 車線の生成
    const leftLinePoints = points;
    const rightLinePoints = points.map((point, index) => {
      return new THREE.Vector3().addVectors(
        point,
        normalVectors[index]
          .clone()
          .multiplyScalar(offsetDistance / offsetDistance) // 右にオフセット
      );
    });
    const centerLinePoints = points.map((point, index) => {
      return new THREE.Vector3().addVectors(
        point,
        normalVectors[index]
          .clone()
          .multiplyScalar(offsetDistance / (offsetDistance * 2)) // 左にオフセット
      );
    });

    // 線を作成する関数
    const generateLine = (pointsArray, color, isLineDashed) => {
      let material = null;
      if (!isLineDashed) {
        material = new THREE.LineBasicMaterial({ color: color });
      } else {
        material = new THREE.LineDashedMaterial({
          color: color,
          scale: 100,
          dashSize: 20,
          gapSize: 200000,
        });
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(pointsArray);
      return new THREE.Line(geometry, material);
    };

    // 左、右、中央の線を作成
    const leftLineMesh = generateLine(leftLinePoints, sideLineColor, false);
    const rightLineMesh = generateLine(rightLinePoints, sideLineColor, false);
    const centerLineMesh = generateLine(
      centerLinePoints,
      centerLineColor,
      true
    );

    // 補助線の生成
    const maxZIndex = elevations.indexOf(Math.max(...elevations));
    const minZIndex = elevations.indexOf(Math.min(...elevations));
    const maxZPoint = points[maxZIndex];
    const minZPoint = points[minZIndex];

    const generateVerticalLineToZero = (point, color) => {
      const material = new THREE.LineBasicMaterial({ color: color });
      const linePoints = [];
      linePoints.push(new THREE.Vector3(point.x, point.y, point.z));
      linePoints.push(new THREE.Vector3(point.x, point.y, 0));
      linePoints.push(new THREE.Vector3(0, 0, 0));

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const verticalLineMeth = new THREE.Line(lineGeometry, material);
      return verticalLineMeth;
    };

    // const verticalLineMeth = addVerticalLineToZero(maxPoint, 0x00ffff); // 青色で最高点からZ軸0までの線
    const verticalLineMaxZMeth = generateVerticalLineToZero(
      maxZPoint,
      0xff00ff
    );
    const verticalLineMinZMeth = generateVerticalLineToZero(
      minZPoint,
      0xffff00
    );

    return {
      roadMesh,
      leftLineMesh,
      rightLineMesh,
      centerLineMesh,
      verticalLineMaxZMeth,
      verticalLineMinZMeth,
    };
  };

  /**
   * 地形メッシュを生成
   */
  const generateTerrainMesh = async (
    terrainData,
    baseLat,
    baseLon,
    baseElev
  ) => {
    // // グリッドの座標と高さデータ（多次元配列: x, y, z）
    // const baseLat = terrainData[0][0][0]; // 基準の緯度
    // const baseLon = terrainData[0][0][1]; // 基準の経度
    // const baseElev = terrainData[0][0][2]; // 基準の標高

    // gridDataを基に各座標を基準からの相対的な座標に変換し、Vector3オブジェクトを作成
    const gridData = terrainData.map((data) => {
      // console.log(data);
      return data.map((d) => {
        // console.log(d);
        const lat = d[0]; // 緯度
        const lon = d[1]; // 経度
        const elev = d[2]; // 標高

        // 基準座標に対する相対座標を計算
        const x = (lon - baseLon) / 10; // 経度の差をX座標として正規化
        const y = (lat - baseLat) / 10; // 緯度の差をY座標として正規化
        const z = (elev - baseElev) / 6; // 標高の差をZ座標として正規化

        return [x, y, z];
      });
    });
    // ジオメトリの作成
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    // 頂点データを取得して三角形を作成
    for (let y = 0; y < gridData.length - 1; y++) {
      for (let x = 0; x < gridData[y].length - 1; x++) {
        // 2つの三角形で1つの四角形を構成
        const v0 = gridData[y][x];
        const v1 = gridData[y + 1][x];
        const v2 = gridData[y][x + 1];
        const v3 = gridData[y + 1][x + 1];

        // 1つ目の三角形
        vertices.push(...v0);
        vertices.push(...v1);
        vertices.push(...v2);

        // 2つ目の三角形
        vertices.push(...v2);
        vertices.push(...v1);
        vertices.push(...v3);
      }
    }

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertices), 3)
    );

    // 中心座標を計算 (X, Y, Zの範囲を取得して中心を計算)
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    const centerX = (boundingBox.max.x + boundingBox.min.x) / 2;
    const centerY = (boundingBox.max.y + boundingBox.min.y) / 2;
    const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2;

    // // ジオメトリの中心をシーンの中心に移動
    // geometry.translate(-centerX, -centerY, -centerZ);

    // 面の表面を表すベクトルを自動計算
    geometry.computeVertexNormals(); // 法線を自動計算

    // マテリアルを作成
    const material = new THREE.MeshStandardMaterial({
      // side: THREE.DoubleSide,
      color: 0x00ff00, // 緑色
      roughness: 0.8, // ラフネス (0: つるつる, 1: ザラザラ)
      metalness: 0.5, // 金属度 (0: 非金属, 1: 金属)
      latShading: false, // スムースシェーディングを有効にする
      transparent: true, // 透明を有効化
      opacity: 0.6,
    });

    // メッシュを作成し、シーンに追加
    const mesh = new THREE.Mesh(geometry, material);
    // mesh.receiveShadow = true; // 影を落とす

    return mesh;
  };

  /**
   * 環境光を生成
   */
  const generateAmbientLight = () => {
    // 環境光(全体を光らせる)を追加
    // const ambientLight = new THREE.AmbientLight(0xffffff, 0);
    const ambientLight = new THREE.HemisphereLight(
      0xffffff, // 上からの光
      0x0000ff, // 下からの光
      0.3
    );
    return ambientLight;
  };

  /**
   * ディレクショナルライトを生成
   */
  const generateDirectionalLight = () => {
    // ライトの追加（影のための光源）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 40); // ライトの位置
    directionalLight.castShadow = true; // ライトに影を有効化
    // directionalLight.shadow.mapSize.width = 4096; // 高解像度に設定
    // directionalLight.shadow.mapSize.height = 4096;

    // DirectionalLightHelperを追加して光源の位置と方向を視覚化
    const directionalLightHelper = new THREE.DirectionalLightHelper(
      directionalLight,
      5
    );

    // カメラヘルパーを追加して影の影響範囲を視覚化
    const shadowCameraHelper = new THREE.CameraHelper(
      directionalLight.shadow.camera
    );
    return {
      directionalLight,
      directionalLightHelper,
      shadowCameraHelper,
    };
  };

  /**
   * // 道路の上を移動するオブジェクトを作成
   */
  const generateRoadOnObject = (camera) => {
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32); // 半径1、詳細度32の球体
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
    }); // 赤色の球体
    const movingObjectMeth = new THREE.Mesh(sphereGeometry, sphereMaterial); // 球体のメッシュを作成

    const animateObjectOnRoad = (object, line, speed) => {
      const points = line.geometry.attributes.position.array;
      const pointCount = points.length / 3; // 3次元座標なので、ポイント数は3で割る

      let progress = 0; // オブジェクトの進行度（0から1まで）

      function animateObject() {
        // オブジェクトの進行度を更新
        progress += speed;
        if (progress > 1) progress = 0; // 1を超えたらリセット

        // 線の上の位置を線形補間で取得
        const index = Math.floor(progress * (pointCount - 1)); // 現在のインデックスを計算
        const nextIndex = index + 1 < pointCount ? index + 1 : index; // 次のインデックス
        const lerpFactor = (progress * (pointCount - 1)) % 1; // 線形補間のためのファクター

        // 2つのポイント間の位置を補間
        const x = THREE.MathUtils.lerp(
          points[index * 3],
          points[nextIndex * 3],
          lerpFactor
        );
        const y = THREE.MathUtils.lerp(
          points[index * 3 + 1],
          points[nextIndex * 3 + 1],
          lerpFactor
        );
        const z = THREE.MathUtils.lerp(
          points[index * 3 + 2],
          points[nextIndex * 3 + 2],
          lerpFactor
        );

        // オブジェクトを新しい位置に移動（groupの位置補正を適用）
        object.position.set(
          x + group.position.x,
          y + group.position.y,
          z + group.position.z
        );

        // 次のポイントから方向ベクトルを計算
        const nextPosition = new THREE.Vector3(
          points[nextIndex * 3] + group.position.x,
          points[nextIndex * 3 + 1] + group.position.y,
          points[nextIndex * 3 + 2] + group.position.z
        );
        const currentPosition = new THREE.Vector3(
          x + group.position.x,
          y + group.position.y,
          z + group.position.z
        );
        const direction = new THREE.Vector3()
          .subVectors(nextPosition, currentPosition)
          .normalize();

        // カメラの位置を動的に計算
        const cameraOffset = direction.clone().multiplyScalar(-30); // さらに後方にカメラを配置
        cameraOffset.z = 20; // 高さを少し下げて角度を小さくする
        const targetCameraPosition = currentPosition.clone().add(cameraOffset);

        // カメラの位置を滑らかに補間して移動
        camera.position.lerp(targetCameraPosition, 0.05); // 0.1で滑らかに補間

        // カメラが少し先を見るように調整
        const lookAheadOffset = direction.clone().multiplyScalar(10); // カメラが見つめるポイントを少し前に
        const targetLookAtPosition = nextPosition.clone().add(lookAheadOffset);

        // カメラの向きを滑らかに補間
        const currentLookAt = new THREE.Vector3();
        camera.getWorldDirection(currentLookAt);
        const smoothLookAt = currentLookAt.lerp(
          targetLookAtPosition.sub(camera.position).normalize(),
          0.1
        );
        camera.lookAt(camera.position.clone().add(smoothLookAt));

        // アニメーションを継続
        requestAnimationFrame(animateObject);
      }

      // アニメーションを開始
      animateObject();
    };

    return { movingObjectMeth, animateObjectOnRoad };
  };

  const width = 1800;
  const height = 1100;

  // シーン、カメラ、レンダラーの作成
  const renderer = generateRenderer(width, height);
  document.getElementById("road3DArea").appendChild(renderer.domElement);
  const scene = generateScene();
  const { camera } = generateCamera(renderer, width, height);

  // グループを作成
  const group = new THREE.Group();
  // 中心座標を計算 (X, Y, Zの範囲を取得して中心を計算)

  // 地形ロード
  const terrainData = await loadJson(terrain_elevation_path);

  // 基準の緯度、経度、標高を取得
  const baseLat = terrainData[0][0][0]; // 基準の緯度
  const baseLon = terrainData[0][0][1]; // 基準の経度
  const baseElev = terrainData[0][0][2]; // 基準の標高

  // 地形メッシュの作成
  const terrainMesh = await generateTerrainMesh(
    terrainData,
    baseLat,
    baseLon,
    baseElev
  );
  group.add(terrainMesh);

  // 道のメッシュを作成
  const {
    roadMesh,
    leftLineMesh,
    rightLineMesh,
    centerLineMesh,
    verticalLineMaxZMeth,
    verticalLineMinZMeth,
  } = generateRoadMesh(elevations, coordinates, baseLat, baseLon, baseElev);
  group.add(roadMesh);
  group.add(leftLineMesh);
  group.add(rightLineMesh);
  group.add(centerLineMesh);

  // group.add(verticalLineMaxZMeth);
  // group.add(verticalLineMinZMeth);
  // const axesHelper = new THREE.AxesHelper(100); // 軸の長さを指定
  // scene.add(axesHelper);

  // roadMesh上を走るオブジェクトを作成
  const { movingObjectMeth, animateObjectOnRoad } =
    generateRoadOnObject(camera);
  group.add(movingObjectMeth);
  // オブジェクトをセンターライン上に走らせる
  animateObjectOnRoad(movingObjectMeth, centerLineMesh, 0.0006);

  // グループを中心座標に移動してシーンに追加
  const boundingBox = terrainMesh.geometry.boundingBox;
  const centerX = (boundingBox.max.x + boundingBox.min.x) / 2;
  const centerY = (boundingBox.max.y + boundingBox.min.y) / 2;
  const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2;
  // group.position.set(-centerX, -centerY, -centerZ);

  scene.add(group);

  // 光源の追加
  const ambientLight = generateAmbientLight();
  scene.add(ambientLight);
  const { directionalLight, directionalLightHelper, shadowCameraHelper } =
    generateDirectionalLight();
  scene.add(directionalLight);
  // scene.add(directionalLightHelper);
  // scene.add(shadowCameraHelper);

  // レンダリングの設定
  function animate() {
    requestAnimationFrame(animate);
    // cameraControls.update(); // OrbitControlsを更新
    // scene.rotation.z += 0.01;
    renderer.render(scene, camera);
  }
  animate();
};
