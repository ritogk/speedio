import "dotenv/config";

export interface Config {
  googleMapsApiKey: string;
  anthropicApiKey: string;
}

// 環境変数を検証して設定を取得
export function loadConfig(): Config {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!googleMapsApiKey) {
    console.error("エラー: GOOGLE_MAPS_API_KEY が設定されていません");
    console.error(".env ファイルを作成し、Google Maps APIキーを設定してください");
    process.exit(1);
  }

  if (!anthropicApiKey) {
    console.error("エラー: ANTHROPIC_API_KEY が設定されていません");
    console.error(".env ファイルを作成し、Anthropic APIキーを設定してください");
    process.exit(1);
  }

  return {
    googleMapsApiKey,
    anthropicApiKey,
  };
}
