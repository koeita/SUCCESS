# 🎓 高校生活・大学受験育成シミュレーションゲーム『SUCCESS』

[![Play Online](https://img.shields.io/badge/Play-Game%20Online-blue?style=for-the-badge&logo=google-chrome)](https://success.xcangcheng.workers.dev/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github)](https://github.com/koeita/SUCCESS)

高校3年間（全144週）の学校生活・部活動・勉強・息抜きを通じて学力を伸ばし、志望大学現役合格を目指す育成シミュレーションゲームです。  
外部ライブラリや重いフレームワークを一切使用せず、純粋なWeb標準技術（HTML5 / Vanilla JavaScript / CSS3 / Web Audio API）のみで制作されています。

---

## 🎮 今すぐプレイ
👉 **[ゲームをプレイする (Webブラウザで直接起動)](https://success.xcangcheng.workers.dev/)**  
※ PC・スマートフォン（iOS / Android）の全画面・レスポンシブ表示（`100dvh`対応）に対応しており、ブラウザからインストール不要で即座に遊べます。

---

## ✨ 主なゲームシステム
- **高校3年間（144ターン）育成システム**: 4月から翌々年3月まで、勉強・出かける・休養・購買部のコマンドを選択
- **学力・リアル偏差値システム**: 4教科＋副教科（情報I）を勉強して経験値を蓄積。学力ランク（G〜S）とリアル偏差値（35〜75）が連動
- **志望校＆複線入試バトル**: 共通テスト本番（新課程1000点満点）、私大併願、国公立前期・後期日程の入試バトル
- **文理選択＆15大学学部傾斜配点**: 文系・理系の選択に応じた出題比率と各大学の傾斜配点を忠実に再現
- **購買部＆アイテムマネジメント**: お小遣いを使って参考書や栄養ドリンクを購入。統一カラー効果タグ（消費・回復・やる気・経験値）で分かりやすいUI
- **交友関係＆歴代OB名簿システム**: 友人やライバルとのイベント、そして第一志望に合格した先輩（殿堂入り）からの差し入れシステム
- **Web Audio API 完全自作BGM/SE**: タイトル曲・日常曲・試験バトル曲の3曲をブラウザ標準APIでリアルタイム合成

---

## 🛠 技術スタック
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Audio Engine**: Web Audio API (Synthesizer / Sound Generator)
- **Deployment**: Cloudflare Workers / Pages
