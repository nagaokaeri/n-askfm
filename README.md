
askfmをスクレイピングして保存するツールです。

## 実行方法

### 必要なライブラリのインストール

```
npm install
```

### スクレイピング

```
node askfm.js fetch [username]
```

フォルダ `db/` 以下に sqlite3 のファイルが作られます。
2回目以降の実行で、すでに取得した分まで取得し終わったら `Ctrl+C` で適当に終了します。

### DBに格納した結果表示

```
node askfm.js show [username] [limit]
```

新しい順に `limit` 件を標準出力に表示します。適当なファイルにリダイレクトして使うことが多いと思います。
