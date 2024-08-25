export const drawGraph = (corners_group, elevation_smooth) => {
  drawCornerGraph(corners_group);
  drawElevationGraph(elevation_smooth);
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
          return sum + item.max_steering_angle;
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
 */
const drawElevationGraph = (elevation_smooth) => {
  const minElevation = Math.min(...elevation_smooth);
  const maxElevation = Math.max(...elevation_smooth);
  const adjustedElevations = elevation_smooth.map((x) => x - minElevation);
  var ctx = document.getElementById("graphElevationCanvas").getContext("2d");
  // console.log(minElevation);
  // console.log(maxElevation);
  // console.log(adjustedElevations);

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
      ],
    },
    options: {
      scales: {
        y: {
          min: 0,
          max: 250,
          ticks: {
            stepSize: 30,
          },
        },
      },
    },
  });
};
