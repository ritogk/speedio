import { generateGoogleMapUrl } from "./generateGoogleMapUrl.js";

// 各targetを実際に現場で調査するためのmarkdownテーブルを生成する関数

export const formatNumber = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return String(value ?? "");
  return (Math.round(value * 1000) / 1000).toString();
};

export const createMarkdownHeaderFromTargets = (targets) => {
  if (!Array.isArray(targets) || targets.length === 0) {
    return "";
  }

  const scoreKeysSet = new Set();
  targets.forEach((t) => {
    Object.keys(t || {})
      .filter((key) => key.startsWith("score"))
      .forEach((key) => scoreKeysSet.add(key));
  });

  const scoreKeys = Array.from(scoreKeysSet).sort();
  // 先頭に空列、name の後に空列を追加
  const headers = ["", "name", "", ...scoreKeys];
  const headerRow = `| ${headers.join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;
  return [headerRow, separatorRow].join("\n");
};

export const createMarkdownTableFromTargets = (targets, options = {}) => {
  const { includeHeader = true } = options;
  if (!Array.isArray(targets) || targets.length === 0) {
    return "";
  }

  const first = targets[0];
  const scoreKeysSet = new Set();

  // 各 target から score 系のキーを収集（列順はソートで安定化）
  targets.forEach((t) => {
    Object.keys(t || {})
      .filter((key) => key.startsWith("score"))
      .forEach((key) => scoreKeysSet.add(key));
  });

  const scoreKeys = Array.from(scoreKeysSet).sort();
  // 先頭に空列、name の後に空列を追加
  const headers = ["", "name", "", ...scoreKeys];
  const headerRow = `| ${headers.join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  const rows = targets.map((t) => {
    const values = [];
    const name = t.name ?? "";
    try {
      if (Array.isArray(t.geometry_list) && t.geometry_list.length > 0) {
        const url = generateGoogleMapUrl(t.geometry_list);
        // 先頭の空列
        values.push("");
        // name 列（リンク付き）
        values.push(`[${name}](${url})`);
        // name 後の空列
        values.push("");
      } else {
        values.push("");
        values.push(name);
        values.push("");
      }
    } catch (e) {
      values.push("");
      values.push(name);
      values.push("");
    }

    scoreKeys.forEach((key) => {
      values.push(formatNumber(t[key]));
    });

    return `| ${values.join(" | ")} |`;
  });

  if (includeHeader) {
    return [headerRow, separatorRow, ...rows].join("\n");
  }
  return rows.join("\n");
};

export const createMarkdownTableFromTarget = (target, options = {}) => {
  return createMarkdownTableFromTargets([target], options);
};
