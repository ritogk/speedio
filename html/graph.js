export const drawGraph = (corners, corners_group, elevation_smooth) => {
  drawCornerGraph(corners_group);
  drawElevationGraph(elevation_smooth, corners);
};

/**
 * コーナーのグラフを描画
 * @param {*} corners_group
 */
const drawCornerGraph = (corners_group) => {
  var ctx = document.getElementById("graphCanvas").getContext("2d");

  const cornerGroupDistance = Object.keys(corners_group).map((group) => {
    return corners_group[group].reduce((sum, item) => {
      return sum + item.distance;
    }, 0);
  });
  const maxCornerGroupDistance = Math.max(...cornerGroupDistance);

  const cornerGroupAvgSteeringAngle = Object.keys(corners_group).map(
    (group) => {
      return (
        corners_group[group].reduce((sum, item) => {
          return sum + item.avg_steering_angle;
        }, 0) / corners_group[group].length
      );
    }
  );
  const cornerGroupMaxSteeringAngle = Object.keys(corners_group).map(
    (group) => {
      return (
        corners_group[group].reduce((sum, item) => {
          return sum + item.adjusted_steering_angle;
        }, 0) / corners_group[group].length
      );
    }
  );

  // distance * (avg / 50)
  const distanceRatioAngle = cornerGroupDistance.map((x, i) => {
    return (
      x * (cornerGroupAvgSteeringAngle[i] / cornerGroupMaxSteeringAngle[i])
    );
  });

  new Chart(ctx, {
    type: "bar", // デフォルトのチャートタイプを設定
    data: {
      labels: Array.from({ length: 11 }, (_, i) => i * 10), // 横メモリを10単位に
      datasets: [
        {
          label: "steering_angle",
          data: cornerGroupDistance, // 棒グラフ
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
        {
          label: "steering_avg_angle",
          type: "line", // 折れ線グラフとして設定
          data: distanceRatioAngle, // 折れ線グラフデータ
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          fill: false,
        },
      ],
    },
    options: {
      scales: {
        x: {
          ticks: {
            stepSize: 10, // 横軸の目盛りの単位
          },
        },
        y: {
          suggestedMax: maxCornerGroupDistance, // 縦軸の上限
        },
      },
    },
  });
};

/**
 * 標高のグラフを描画
 * @param {*} elevation_smooth
 * @param {*} corners
 */
const drawElevationGraph = (elevation_smooth, corners) => {
  const graphYMax = 300;
  const minElevation = Math.min(...elevation_smooth);
  const maxElevation = Math.max(...elevation_smooth);
  const adjustedElevations = elevation_smooth.map((x) => x - minElevation);
  var ctx = document.getElementById("graphElevationCanvas").getContext("2d");
  // console.log(minElevation);
  // console.log(maxElevation);
  // console.log(adjustedElevations);

  const steeringAngleData = corners
    .map((corner) => {
      return corner.corner_info.map((x) => {
        return x.steering_angle;
      });
    })
    .flat();
  const directions = corners
    .map((corner) => {
      return corner.corner_info.map((x) => {
        return x.direction;
      });
    })
    .flat();
  // 先頭と末尾に0を追加
  steeringAngleData.unshift(steeringAngleData[0]);
  steeringAngleData.push(steeringAngleData[steeringAngleData.length - 1]);
  const minSteeringAngle = Math.min(...steeringAngleData);
  const maxSteeringAngle = Math.max(...steeringAngleData);
  // 角度の最大値100を標高の最大値のスケールに変換
  const adjustedSteeringAngle = steeringAngleData.map((x) => {
    return x;
    // const adjustedAngle = x * (graphYMax / 100);
    // if (adjustedAngle >= 300) return 300;
    // return adjustedAngle;
  });
  console.log(adjustedSteeringAngle);
  console.log(elevation_smooth);

  const directionColors = {
    straight: "rgba(0, 255, 132, 1)",
    left: "rgba(255, 99, 132, 1)",
    right: "rgba(54, 162, 235, 1)",
  };

  new Chart(ctx, {
    type: "line", // デフォルトのチャートタイプを設定
    data: {
      labels: Array.from(
        { length: adjustedElevations.length },
        (_, i) => i + 1
      ), // データポイントに対応するラベル
      datasets: [
        {
          label: `elevation max:${Math.trunc(Math.max(...adjustedElevations))}`,
          type: "line", // 折れ線グラフとして設定
          data: adjustedElevations, // 折れ線グラフデータ
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderWidth: 1,
          pointRadius: 1,
          fill: false,
        },
        {
          label: `steeringAngle max:${maxSteeringAngle}`,
          type: "line", // 折れ線グラフとして設定
          data: adjustedSteeringAngle, // 折れ線グラフデータ
          borderColor: "rgba(0, 255, 132, 1)",
          backgroundColor: "rgba(0, 255, 132, 0.2)",
          borderWidth: 1,
          pointRadius: 1,
          fill: false,
          tension: 0.3,
          segment: {
            borderColor: (ctx) => {
              const index = ctx.p0DataIndex;
              const direction = directions[index];
              return directionColors[direction] || "rgba(0, 0, 0, 1)";
            },
          },
        },
      ],
    },
    options: {
      scales: {
        y: {
          min: 0,
          max: graphYMax,
          ticks: {
            stepSize: 30,
          },
        },
      },
      responsive: false,
    },
  });
};
