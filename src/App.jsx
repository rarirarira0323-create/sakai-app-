import { useState, useEffect, useCallback } from "react";

// ─── Storage ─────────────────────────────────────────────────
const storageGet = (key, fallback) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
};
const storageSet = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

// ─── 日本の祝日 2026 ─────────────────────────────────────────
const HOLIDAYS_2026 = new Set([
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20",
  "2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23","2026-12-23",
]);
const isHoliday = (dk) => HOLIDAYS_2026.has(dk);
const isWeekday = (dow) => dow >= 1 && dow <= 5;
const isWeekendOrHoliday = (dk, dow) => !isWeekday(dow) || isHoliday(dk);
const isWeekdayHoliday = (dk, dow) => isWeekday(dow) && isHoliday(dk);

// ─── 今日のテーマ ────────────────────────────────────────────
const THEMES = [
  "「普」という字は仮面に見える","沈黙はどこまで誠実か","人は何のために働くのか",
  "嘘をつく動物と嘘をつかない動物","お金は自由か、それとも鎖か","孤独と孤立の違い",
  "なぜ人は習慣を破るのか","強さとは何を我慢することか","本音と建前はなぜ共存するのか",
  "時間を買えるとしたら何を売るか","美学とは何に反するかで決まる","人に期待することは正しいか",
  "怒りは二次感情である","死を意識すると何が変わるか","自分を律することと自分を縛ることの違い",
  "感謝と負債はどこが違うか","なぜ人は誰かに認められたいのか","信頼は貯金か、それとも水か",
  "完璧主義は優しさか残酷さか","言語化できないものに価値はあるか","記憶と事実はなぜずれるのか",
  "誠実さは弱さに見えることがある","なぜ人は後悔を繰り返すのか","選択肢が多いと人は不幸になるか",
  "他人の幸福を喜べる人間は何が違うか","プライドと自尊心の違い","義務と使命はどこで分かれるか",
  "愛情と執着の境界線","退屈は才能を育てるか","なぜ人は物語を必要とするのか",
  "恥をかくことの意味","知識と知恵はなぜ別物か","自由意志は存在するか",
  "人はなぜ他人と比較するのか","変わることへの恐怖の正体","本物と偽物の違いは誰が決めるか",
  "なぜ人は同じ失敗をするのか","感情は情報か、それとも雑音か","居場所とはどこに存在するか",
];
const getDailyTheme = (dk) => {
  const seed = dk.replace(/-/g,"");
  const idx = parseInt(seed) % THEMES.length;
  return THEMES[Math.abs(idx)];
};

// ─── 定数 ────────────────────────────────────────────────────
const TODAY = new Date();
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayKey = dateKey(TODAY);
const fmt = (n) => `¥${Number(n||0).toLocaleString()}`;
const calcBMI = (weight, height) => weight && height ? (weight / ((height/100) ** 2)).toFixed(1) : null;
const bmiLabel = (bmi) => {
  if (!bmi) return null;
  const b = parseFloat(bmi);
  if (b < 18.5) return { label:"低体重", color:"#B5D4F4" };
  if (b < 25)   return { label:"標準",   color:"#34D399" };
  if (b < 30)   return { label:"肥満1度", color:"#F5C842" };
  return              { label:"肥満2度以上", color:"#FF6B6B" };
};

// ─── アクション定義 ───────────────────────────────────────────
const ACTIONS = [
  { id:"note",   label:"note執筆",       icon:"✍️", color:"#C4973A", category:"副業",  minScore:-3, days:"all" },
  { id:"x",      label:"X投稿",          icon:"𝕏",  color:"#C4973A", category:"副業",  minScore:-5, days:"all" },
  { id:"novel",  label:"小説執筆",       icon:"📖", color:"#5B9BD5", category:"創作",  minScore:0,  days:"all" },
  { id:"boki",   label:"簿記勉強",       icon:"📊", color:"#4ECDC4", category:"学習",  minScore:-2, days:"all" },
  { id:"gym",    label:"筋トレ",         icon:"💪", color:"#C0756A", category:"健康",  minScore:-5, days:"weekday" },
  { id:"swim",   label:"水泳",           icon:"🏊", color:"#4ECDC4", category:"健康",  minScore:-5, days:"sat" },
  { id:"sauna",  label:"サウナ",         icon:"🧖", color:"#C0756A", category:"健康",  minScore:-3, days:"sun" },
  { id:"sleep",  label:"0時就寝",        icon:"🌙", color:"#8B7FD4", category:"健康",  minScore:-5, days:"all" },
  { id:"blood",  label:"献血",           icon:"🩸", color:"#C0756A", category:"社会",  minScore:1,  days:"holiday_weekday" },
  { id:"epay",   label:"電子決済まとめ", icon:"💳", color:"#5B9BD5", category:"家計",  minScore:-5, days:"sun" },
];

const getActionsForDay = (dk, dow, score) => {
  return ACTIONS.filter(a => {
    // 曜日フィルタ
    if (a.days === "sat" && dow !== 6) return false;
    if (a.days === "sun" && dow !== 0) return false;
    if (a.days === "weekday" && isWeekendOrHoliday(dk, dow)) return false;
    if (a.days === "holiday_weekday" && !isWeekdayHoliday(dk, dow)) return false;
    // スコアフィルタ
    if (score < a.minScore) return false;
    return true;
  });
};

const LEDGER = {
  morning: {
    label:"☀️ 朝",
    debit:  [
      { id:"m_d1", label:"よく眠れた",     value:3 },
      { id:"m_d2", label:"朝食をとった",    value:2 },
      { id:"m_d3", label:"気持ちが安定",    value:2 },
      { id:"m_d4", label:"やることが明確",  value:2 },
    ],
    credit: [
      { id:"m_c1", label:"寝不足",         value:-3 },
      { id:"m_c2", label:"朝から疲れてる",  value:-2 },
      { id:"m_c3", label:"気分が乗らない",  value:-2 },
    ],
  },
  noon: {
    label:"🌤 昼",
    debit:  [
      { id:"n_d1", label:"午前が順調",      value:2 },
      { id:"n_d2", label:"食事をとれた",    value:1 },
      { id:"n_d3", label:"集中できてる",    value:3 },
    ],
    credit: [
      { id:"n_c1", label:"午前が崩れた",    value:-2 },
      { id:"n_c2", label:"疲れが出てきた",  value:-2 },
      { id:"n_c3", label:"誰かにイライラ",  value:-3 },
    ],
  },
  evening: {
    label:"🌙 夜",
    debit:  [
      { id:"e_d1", label:"仕事が終わった",  value:2 },
      { id:"e_d2", label:"達成感がある",    value:3 },
      { id:"e_d3", label:"気持ちが安定",    value:2 },
      { id:"e_d4", label:"やることが明確",  value:2 },
    ],
    credit: [
      { id:"e_c1", label:"疲れて帰ってきた", value:-2 },
      { id:"e_c2", label:"嫌なことがあった", value:-2 },
      { id:"e_c3", label:"感情が乱れている", value:-3 },
      { id:"e_c4", label:"誰かへのイライラ", value:-2 },
      { id:"e_c5", label:"気分が乗らない",  value:-2 },
    ],
  },
};

const getMode = (score) => {
  if (score >= 4)  return { label:"フル稼働",  color:"#34D399", desc:"全タスクこなせる日。積極的に動こう。" };
  if (score >= 1)  return { label:"通常運転",  color:"#F5C842", desc:"スケジュール通りに動ける。" };
  if (score >= -2) return { label:"最低限",    color:"#FB923C", desc:"必須タスクだけでいい。" };
  return                   { label:"サバイバル", color:"#FF6B6B", desc:"一つだけやれれば十分。休むことも戦略。" };
};

const ASSET_ACCOUNTS = [
  { key:"nisa",     label:"NISA",    color:"#34D399" },
  { key:"defense",  label:"防衛資金", color:"#F5C842" },
  { key:"sbi_main", label:"SBI",     color:"#B5D4F4" },
  { key:"rakuten",  label:"楽天",    color:"#FF6B6B" },
];
const INIT_ASSETS = { nisa:0, defense:0, sbi_main:0, rakuten:0 };

// ─── Styles ───────────────────────────────────────────────────
const S = {
  app:  { background:"#1A1F2E", minHeight:"100vh", color:"#D4D8E8", fontFamily:"'Georgia', serif", padding:"12px 14px", maxWidth:480, margin:"0 auto" },
  card: { background:"#242938", border:"1px solid #2E3448", borderRadius:6, padding:"14px", marginBottom:12 },
  btn:  (active, color="#C4973A") => ({
    background: active ? color : "transparent",
    color: active ? "#1A1F2E" : "#6B7280",
    border: `1px solid ${active ? color : "#2E3448"}`,
    borderRadius:4, padding:"6px 12px", cursor:"pointer",
    fontSize:12, fontWeight: active ? 700 : 400, fontFamily:"inherit",
  }),
  input: { background:"#242938", border:"1px solid #3A4060", borderRadius:4, color:"#D4D8E8", padding:"8px 10px", fontSize:16, fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
  tag:  (color) => ({ background:`${color}22`, color, border:`1px solid ${color}44`, borderRadius:3, padding:"2px 7px", fontSize:11 }),
};

// ─── WORKOUT ─────────────────────────────────────────────────
const WORKOUT = {
  chest: {
    label:"胸", icon:"💪", color:"#FF6B6B",
    levels: [
      { label:"Level 1", sub:"15〜20分 / 疲弊してる日", color:"#555",
        sets:[
          { name:"PUバー 通常腕立て", sets:3, reps:"10回", note:"深く下ろして大胸筋を伸ばす" },
          { name:"ワイド腕立て",      sets:2, reps:"10回", note:"手幅肩幅の1.5倍" },
        ]},
      { label:"Level 2", sub:"30〜40分 / 普通の日", color:"#F5C842",
        sets:[
          { name:"PUバー 通常腕立て", sets:4, reps:"15回", note:"可動域フルに使う" },
          { name:"PUバー ワイド",     sets:3, reps:"12回", note:"大胸筋外側を意識" },
          { name:"PUバー ナロー",     sets:3, reps:"10回", note:"内側・三頭筋に効く" },
          { name:"デクライン腕立て",  sets:3, reps:"10回", note:"足を台に乗せて下部狙い" },
        ]},
      { label:"Level 3", sub:"50〜60分 / やる気MAX", color:"#34D399",
        sets:[
          { name:"PUバー 通常腕立て",       sets:5, reps:"20回", note:"ウォームアップ込み" },
          { name:"PUバー ワイド",           sets:4, reps:"15回", note:"最大伸展で効果倍増" },
          { name:"PUバー ナロー",           sets:4, reps:"12回", note:"肘を体に沿わせる" },
          { name:"デクライン腕立て",        sets:3, reps:"12回", note:"下部〜外側を仕上げ" },
          { name:"PUバー ディップス",       sets:3, reps:"12回", note:"体を前傾で大胸筋に集中" },
          { name:"アーチャープッシュアップ", sets:3, reps:"8回",  note:"左右交互・片側強化" },
        ]},
    ]
  },
  back: {
    label:"背中", icon:"🏋️", color:"#B5D4F4",
    levels: [
      { label:"Level 1", sub:"15〜20分 / 疲弊してる日", color:"#555",
        sets:[
          { name:"懸垂（ぶら下がり機）", sets:3, reps:"限界回数", note:"降りる時もゆっくり3秒" },
          { name:"スーパーマン",          sets:3, reps:"15回",     note:"2秒キープで脊柱起立筋" },
        ]},
      { label:"Level 2", sub:"30〜40分 / 普通の日", color:"#F5C842",
        sets:[
          { name:"懸垂",                   sets:4, reps:"8回",  note:"肩甲骨を寄せながら引く" },
          { name:"チンアップ（逆手）",     sets:3, reps:"8回",  note:"二頭筋も同時強化" },
          { name:"ダンベルロウ（片手4kg）", sets:3, reps:"12回", note:"台に膝ついて肘を引く" },
          { name:"スーパーマン",           sets:3, reps:"15回", note:"背筋全体を収縮" },
        ]},
      { label:"Level 3", sub:"50〜60分 / やる気MAX", color:"#34D399",
        sets:[
          { name:"懸垂",                    sets:5, reps:"限界", note:"広背筋に意識を集中" },
          { name:"チンアップ（逆手）",      sets:3, reps:"8回",  note:"顎をバーの上まで" },
          { name:"ワイド懸垂",              sets:3, reps:"6回",  note:"広背筋外側を狙う" },
          { name:"ダンベルロウ（片手4kg）", sets:4, reps:"15回", note:"可動域フルに使う" },
          { name:"スーパーマン",            sets:4, reps:"15回", note:"脊柱起立筋仕上げ" },
          { name:"ぶら下がりニーレイズ",    sets:3, reps:"15回", note:"体幹も同時に鍛える" },
        ]},
    ]
  },
  abs: {
    label:"腹", icon:"🔥", color:"#F5C842",
    levels: [
      { label:"Level 1", sub:"15〜20分 / 疲弊してる日", color:"#555",
        sets:[
          { name:"アブローラー 膝コロ", sets:3, reps:"10回", note:"腰を反らさず戻す" },
          { name:"プランク",            sets:2, reps:"30秒", note:"お尻を下げない" },
        ]},
      { label:"Level 2", sub:"30〜40分 / 普通の日", color:"#F5C842",
        sets:[
          { name:"アブローラー 膝コロ", sets:3, reps:"15回", note:"限界まで前に伸ばす" },
          { name:"レッグレイズ",        sets:3, reps:"15回", note:"下腹部に集中" },
          { name:"プランク",            sets:3, reps:"45秒", note:"腹圧を意識" },
          { name:"ロシアンツイスト",    sets:3, reps:"20回", note:"腹斜筋を狙う" },
        ]},
      { label:"Level 3", sub:"50〜60分 / やる気MAX", color:"#34D399",
        sets:[
          { name:"アブローラー 立ちコロ（挑戦）", sets:3, reps:"5〜8回", note:"膝コロで慣れてから" },
          { name:"アブローラー 膝コロ",           sets:4, reps:"15回",   note:"インターバル短め" },
          { name:"ぶら下がりニーレイズ",          sets:4, reps:"15回",   note:"反動を使わない" },
          { name:"ぶら下がりレッグレイズ",        sets:3, reps:"10回",   note:"足を水平まで上げる" },
          { name:"プランク",                      sets:4, reps:"60秒",   note:"限界まで維持" },
          { name:"ロシアンツイスト",              sets:3, reps:"20回",   note:"足を浮かせると強度UP" },
        ]},
    ]
  },
  lower: {
    label:"下半身", icon:"🦵", color:"#C0DD97",
    levels: [
      { label:"Level 1", sub:"15〜20分 / 疲弊してる日", color:"#555",
        sets:[
          { name:"自重スクワット", sets:3, reps:"15回", note:"膝をつま先より前に出さない" },
          { name:"ヒップリフト",   sets:3, reps:"20回", note:"お尻を締めて1秒キープ" },
        ]},
      { label:"Level 2", sub:"30〜40分 / 普通の日", color:"#F5C842",
        sets:[
          { name:"ダンベルスクワット（両手4kg）", sets:4, reps:"20回", note:"深さ平行まで" },
          { name:"ダンベルランジ（両手4kg）",     sets:3, reps:"12回", note:"左右各12回" },
          { name:"ヒップリフト",                  sets:3, reps:"20回", note:"片足でも可" },
          { name:"カーフレイズ",                  sets:3, reps:"30回", note:"踵をしっかり上げる" },
        ]},
      { label:"Level 3", sub:"50〜60分 / やる気MAX", color:"#34D399",
        sets:[
          { name:"ダンベルスクワット（両手4kg）",   sets:5, reps:"20回", note:"テンポ3-1-3" },
          { name:"ブルガリアンスクワット",           sets:3, reps:"12回", note:"後ろ足を台に・片脚集中" },
          { name:"ダンベルランジ（両手4kg）",       sets:4, reps:"15回", note:"歩行ランジで距離稼ぐ" },
          { name:"ダンベルヒップリフト（胸に4kg）", sets:4, reps:"20回", note:"臀部最大収縮を意識" },
          { name:"シングルレッグカーフレイズ",      sets:4, reps:"20回", note:"片足で重さ調整" },
          { name:"サイドランジ",                    sets:3, reps:"12回", note:"内転筋・股関節を狙う" },
        ]},
    ]
  },
};

// ─── Weekend Schedule ────────────────────────────────────────
const SAT_SCHEDULE = [
  { time:"11:00",       label:"出発",       sub:"TSUTAYA・ゴミ出し・食料買い出し", type:"move",   icon:"🚗" },
  { time:"14:00",       label:"帰宅",       sub:"買い出し完了",                   type:"home",   icon:"🏠" },
  { time:"14:00〜15:30",label:"作業時間",   sub:"執筆・Note・リベシティ投稿など", type:"work",   icon:"✍️" },
  { time:"15:30",       label:"水泳へ出発", sub:"プールへ",                       type:"move",   icon:"🏊" },
  { time:"〜",          label:"水泳",       sub:"体を動かす・リフレッシュ",       type:"health", icon:"💧" },
  { time:"〜",          label:"帰宅・準備", sub:"黒服バイトへ",                   type:"home",   icon:"🌙" },
  { time:"夜",          label:"黒服出勤",   sub:"夜の仕事",                       type:"work",   icon:"🎩" },
];
const SUN_SCHEDULE = [
  { time:"10:00",       label:"起床",         sub:"朝のルーティン・スキンケア",     type:"home",   icon:"☀️" },
  { time:"11:00",       label:"出発",         sub:"図書館へ",                       type:"move",   icon:"🚗" },
  { time:"11:00〜",     label:"図書館で作業", sub:"執筆・Note・集中作業タイム",     type:"work",   icon:"📚" },
  { time:"13:00〜16:00",label:"温泉・サウナ", sub:"週のご褒美・リセット",           type:"health", icon:"♨️" },
  { time:"16:00",       label:"帰宅",         sub:"夕食の準備",                     type:"home",   icon:"🍳" },
  { time:"21:00〜23:00",label:"コメダ珈琲",   sub:"夜の作業タイム・集中できる環境", type:"work",   icon:"☕" },
  { time:"23:00",       label:"帰宅",         sub:"在庫消費中：1〜2杯のお酒",       type:"home",   icon:"🥃" },
  { time:"24:00",       label:"就寝",         sub:"明日への充電",                   type:"sleep",  icon:"🌛" },
];
const TYPE_STYLES = {
  move:   { bar:"#6B7280", bg:"rgba(107,114,128,0.12)" },
  home:   { bar:"#4ECDC4", bg:"rgba(78,205,196,0.10)" },
  work:   { bar:"#C4973A", bg:"rgba(196,151,58,0.12)" },
  health: { bar:"#5B9BD5", bg:"rgba(91,155,213,0.12)" },
  sleep:  { bar:"#8B7FD4", bg:"rgba(139,127,212,0.12)" },
};
const WORK_SUMMARY = {
  "土": ["14:00〜15:30（約1.5時間）"],
  "日": ["午前・図書館（〜13:00）", "21:00〜23:00・コメダ（2時間）"],
};

function WeekendSchedule() {
  const todayDow = TODAY.getDay();
  const [day, setDay] = useState(todayDow === 0 ? "日" : "土");
  const schedule = day === "土" ? SAT_SCHEDULE : SUN_SCHEDULE;
  return (
    <div>
      {/* タブ */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {["土","日"].map(d => (
          <button key={d} onClick={() => setDay(d)} style={{ ...S.btn(day===d), flex:1, fontSize:15, padding:"12px", letterSpacing:3 }}>{d}曜日</button>
        ))}
      </div>

      {/* 作業サマリー */}
      <div style={{ background:"rgba(196,151,58,0.12)", border:"1px solid rgba(196,151,58,0.3)", borderRadius:6, padding:"12px 14px", marginBottom:12 }}>
        <div style={{ fontSize:10, letterSpacing:3, color:"#C4973A", marginBottom:6 }}>✍️ 作業時間</div>
        {WORK_SUMMARY[day].map((t,i) => (
          <div key={i} style={{ fontSize:13, color:"#D4D8E8", letterSpacing:0.5, marginBottom:2 }}>{t}</div>
        ))}
      </div>

      {/* タイムライン */}
      <div style={{ position:"relative" }}>
        <div style={{ position:"absolute", left:52, top:0, bottom:0, width:1, background:"rgba(255,255,255,0.06)" }} />
        {schedule.map((item,i) => {
          const st = TYPE_STYLES[item.type];
          return (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", marginBottom:10, position:"relative" }}>
              <div style={{ width:44, flexShrink:0, paddingTop:14, paddingRight:8, textAlign:"right" }}>
                <span style={{ fontSize:10, color:"#6B7280", letterSpacing:0.5, lineHeight:1.2 }}>{item.time}</span>
              </div>
              <div style={{ width:10, height:10, borderRadius:"50%", background:st.bar, flexShrink:0, marginTop:17, marginLeft:-1, marginRight:12, boxShadow:`0 0 0 3px ${st.bg}`, zIndex:1 }} />
              <div style={{ flex:1, background:st.bg, borderLeft:`3px solid ${st.bar}`, borderRadius:"0 6px 6px 0", padding:"10px 12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:15 }}>{item.icon}</span>
                  <span style={{ fontSize:13, color:"#D4D8E8", fontWeight:500, letterSpacing:0.3 }}>{item.label}</span>
                </div>
                <div style={{ margin:"4px 0 0 24px", fontSize:11, color:"#6B7280", letterSpacing:0.3, lineHeight:1.5 }}>{item.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 凡例 */}
      <div style={{ marginTop:16, display:"flex", flexWrap:"wrap", gap:10 }}>
        {[["work","作業"],["health","健康"],["move","移動"],["home","自宅"],["sleep","睡眠"]].map(([type,label]) => (
          <div key={type} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:TYPE_STYLES[type].bar }} />
            <span style={{ fontSize:10, color:"#6B7280" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── StatusPanel ─────────────────────────────────────────────
const SELF_AXES = [
  { key:"verbal",   label:"言語化",    jp:"Verbalization" },
  { key:"mental",   label:"メンタル防御", jp:"Mental Defense" },
  { key:"meta",     label:"メタ認知",  jp:"Metacognition" },
  { key:"ego",      label:"自我",      jp:"Ego" },
  { key:"physical", label:"身体",      jp:"Physical" },
  { key:"output",   label:"行動力",    jp:"Output" },
];
const KANJIN_AXES = [
  { key:"shiki", label:"識", jp:"知恵・判断" },
  { key:"shi",   label:"志", jp:"価値観・芯" },
  { key:"hen",   label:"変", jp:"窮地の対応" },
  { key:"yuu",   label:"勇", jp:"立ち向かう勇気" },
  { key:"sei",   label:"性", jp:"素の性格" },
  { key:"ren",   label:"廉", jp:"誘惑への節操" },
  { key:"shin",  label:"信", jp:"約束・信頼" },
];

function Radar({ axes, values, color="#2DD4BF", size=300 }) {
  const cx=size/2, cy=size/2, radius=size*0.32, n=axes.length;
  const angle=(i)=>(Math.PI*2*i)/n - Math.PI/2;
  const point=(i,r)=>[cx+Math.cos(angle(i))*radius*(r/100), cy+Math.sin(angle(i))*radius*(r/100)];
  const polygon=values.map((v,i)=>point(i,v).join(",")).join(" ");
  return (
    <svg width={size} height={size} style={{ display:"block", margin:"0 auto" }}>
      {[20,40,60,80,100].map(r=>(<polygon key={r} points={axes.map((_,i)=>point(i,r).join(",")).join(" ")} fill="none" stroke="#1F2937" strokeWidth={1}/>))}
      {axes.map((_,i)=>{ const [x,y]=point(i,100); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#1F2937" strokeWidth={1}/>; })}
      <polygon points={polygon} fill={`${color}44`} stroke={color} strokeWidth={2}/>
      {values.map((v,i)=>{ const [x,y]=point(i,v); return <circle key={i} cx={x} cy={y} r={3} fill={color}/>; })}
      {axes.map((ax,i)=>{ const [x,y]=point(i,124); return <text key={i} x={x} y={y} fontSize={10} fill={color} textAnchor={Math.abs(x-cx)<10?"middle":x>cx?"start":"end"} dominantBaseline="middle">{ax.label}</text>; })}
    </svg>
  );
}

function StatSlider({ label, jp, value, onChange, color }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
        <span style={{ fontSize:13, color:"#D4D8E8" }}>{label} <span style={{ fontSize:10, color:"#6B7280" }}>{jp}</span></span>
        <span style={{ fontSize:13, color, fontWeight:700 }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={e=>onChange(parseInt(e.target.value,10))} style={{ width:"100%", accentColor:color }}/>
    </div>
  );
}

function StatusPanel() {
  const [statTab, setStatTab] = useState("self");
  const [selfVals, setSelfVals] = useState(() => storageGet("sakai:selfVals", { verbal:95, mental:85, meta:90, ego:70, physical:65, output:45 }));
  const [people, setPeople] = useState(() => storageGet("sakai:people", []));
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const saveSelf = (v) => { setSelfVals(v); storageSet("sakai:selfVals", v); };
  const total = (vals) => Object.values(vals).reduce((a,b)=>a+b,0);
  const blank = () => ({ id:`p_${Date.now()}`, name:"", note:"", vals:{ shiki:50, shi:50, hen:50, yuu:50, sei:50, ren:50, shin:50 } });
  const savePerson = (p) => {
    setPeople(prev => {
      const next = prev.find(x=>x.id===p.id) ? prev.map(x=>x.id===p.id?p:x) : [...prev, p];
      storageSet("sakai:people", next); return next;
    });
    setEditing(null); setViewing(null);
  };
  const delPerson = (id) => {
    setPeople(prev => { const next=prev.filter(x=>x.id!==id); storageSet("sakai:people",next); return next; });
    setViewing(null);
  };

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        <button onClick={()=>{ setStatTab("self"); setEditing(null); setViewing(null); }} style={{ ...S.btn(statTab==="self","#2DD4BF"), fontWeight:700 }}>自分</button>
        <button onClick={()=>{ setStatTab("codex"); setEditing(null); setViewing(null); }} style={{ ...S.btn(statTab==="codex","#2DD4BF"), fontWeight:700 }}>人物図鑑（七法）</button>
      </div>

      {statTab==="self" && (
        <div>
          <div style={{ fontSize:11, color:"#6B7280", marginBottom:12 }}>能力ステータス　合計 {total(selfVals)}</div>
          <div style={{ background:"#1A1F2E", borderRadius:12, padding:"16px 0", marginBottom:16 }}>
            <Radar axes={SELF_AXES} values={SELF_AXES.map(a=>selfVals[a.key])} color="#2DD4BF"/>
          </div>
          {SELF_AXES.map(ax=><StatSlider key={ax.key} label={ax.label} jp={ax.jp} value={selfVals[ax.key]} color="#2DD4BF" onChange={v=>saveSelf({...selfVals,[ax.key]:v})}/>)}
        </div>
      )}

      {statTab==="codex" && !editing && !viewing && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:12, color:"#6B7280" }}>登録 {people.length}人</div>
            <button onClick={()=>setEditing(blank())} style={{ ...S.btn(true,"#C4973A"), padding:"7px 14px" }}>＋ 追加</button>
          </div>
          {people.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px", color:"#6B7280", fontSize:13, lineHeight:1.8 }}>まだ誰も登録されていません。<br/>気になる人を七法で鑑定しましょう。</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {people.map(p=>(
                <div key={p.id} onClick={()=>setViewing(p)} style={{ background:"#1A1F2E", border:"1px solid #2E3448", borderRadius:10, padding:10, cursor:"pointer" }}>
                  <Radar axes={KANJIN_AXES} values={KANJIN_AXES.map(a=>p.vals[a.key])} color="#C4973A" size={120}/>
                  <div style={{ fontSize:12, fontWeight:700, color:"#D4D8E8", marginTop:6, textAlign:"center" }}>{p.name||"名無し"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {statTab==="codex" && viewing && !editing && (
        <div>
          <button onClick={()=>setViewing(null)} style={{ ...S.btn(false), padding:"6px 12px", marginBottom:14 }}>← 図鑑に戻る</button>
          <div style={{ fontSize:18, fontWeight:700, color:"#C4973A", marginBottom:12 }}>{viewing.name||"名無し"}</div>
          <div style={{ background:"#1A1F2E", borderRadius:12, padding:"16px 0", marginBottom:14 }}>
            <Radar axes={KANJIN_AXES} values={KANJIN_AXES.map(a=>viewing.vals[a.key])} color="#C4973A"/>
          </div>
          {KANJIN_AXES.map(ax=>(
            <div key={ax.key} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #2E3448" }}>
              <span style={{ fontSize:12, color:"#D4D8E8" }}><span style={{ color:"#C4973A", fontWeight:700 }}>{ax.label}</span> {ax.jp}</span>
              <span style={{ fontSize:13, color:"#C4973A", fontWeight:700 }}>{viewing.vals[ax.key]}</span>
            </div>
          ))}
          {viewing.note && <div style={{ marginTop:12, background:"#1A1F2E", borderRadius:8, padding:12, fontSize:12, color:"#6B7280", lineHeight:1.7 }}>{viewing.note}</div>}
          <div style={{ display:"flex", gap:8, marginTop:16 }}>
            <button onClick={()=>setEditing(viewing)} style={{ ...S.btn(true,"#2DD4BF"), flex:1, padding:"10px" }}>編集</button>
            <button onClick={()=>delPerson(viewing.id)} style={{ ...S.btn(false), padding:"10px 16px" }}>削除</button>
          </div>
        </div>
      )}

      {statTab==="codex" && editing && (
        <div>
          <input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="名前" style={{ ...S.input, marginBottom:14 }}/>
          <div style={{ background:"#1A1F2E", borderRadius:12, padding:"12px 0", marginBottom:14 }}>
            <Radar axes={KANJIN_AXES} values={KANJIN_AXES.map(a=>editing.vals[a.key])} color="#C4973A" size={240}/>
          </div>
          {KANJIN_AXES.map(ax=><StatSlider key={ax.key} label={ax.label} jp={ax.jp} value={editing.vals[ax.key]} color="#C4973A" onChange={v=>setEditing({...editing,vals:{...editing.vals,[ax.key]:v}})}/>)}
          <textarea value={editing.note} onChange={e=>setEditing({...editing,note:e.target.value})} placeholder="メモ（この人の特徴・気づき）" style={{ ...S.input, minHeight:70, resize:"vertical", marginTop:8, marginBottom:14, lineHeight:1.6 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>savePerson(editing)} style={{ ...S.btn(true,"#2DD4BF"), flex:1, padding:"12px" }}>保存</button>
            <button onClick={()=>setEditing(null)} style={{ ...S.btn(false), padding:"12px 18px" }}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CouragePanel ─────────────────────────────────────────────
const COURAGE_RANKS = [
  { key:"small", label:"雑魚敵", exp:2,  color:"#94A3B8", desc:"店員に話しかける／意見を一つ言う／少し多く開示する" },
  { key:"mid",   label:"中ボス", exp:8,  color:"#C4973A", desc:"誰かを誘う／苦手な人に向き合う／断る／本音を伝える" },
  { key:"big",   label:"大ボス", exp:35, color:"#FF6B6B", desc:"告白する／独立を決める／人前で素を晒す" },
];

function levelFromExp(exp) {
  let lv=1, need=10, total=0;
  while (exp >= total+need && lv<100) { total+=need; lv++; need=Math.round(need*1.4); }
  return { lv, cur:exp-total, need };
}

function CouragePanel() {
  const [logs, setLogs] = useState(() => storageGet("sakai:courage", []));
  const [adding, setAdding] = useState(null);
  const [memo, setMemo] = useState("");

  const totalExp = logs.reduce((a,b)=>a+b.exp, 0);
  const { lv, cur, need } = levelFromExp(totalExp);
  const today = `${TODAY.getMonth()+1}/${TODAY.getDate()}`;
  const todayCount = logs.filter(l=>l.date===today).length;

  const addLog = (rank) => {
    const entry = { id:Date.now(), rank:rank.key, label:rank.label, exp:rank.exp, color:rank.color, memo, date:today };
    const next = [entry, ...logs];
    setLogs(next); storageSet("sakai:courage", next); setAdding(null); setMemo("");
  };
  const delLog = (id) => { const next=logs.filter(l=>l.id!==id); setLogs(next); storageSet("sakai:courage",next); };

  return (
    <div>
      <div style={{ background:"linear-gradient(135deg, #1a2e35, #1A1F2E)", border:"1px solid #2DD4BF44", borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, color:"#2DD4BF", letterSpacing:"0.15em" }}>勇気レベル</div>
            <div style={{ fontSize:36, fontWeight:800, color:"#2DD4BF", lineHeight:1 }}>Lv.{lv}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"#6B7280" }}>累計EXP {totalExp}</div>
            <div style={{ fontSize:11, color:"#6B7280" }}>今日 {todayCount}回 / 挑戦 {logs.length}回</div>
          </div>
        </div>
        <div style={{ height:8, background:"#2E3448", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${(cur/need)*100}%`, background:"#2DD4BF", borderRadius:4 }}/>
        </div>
        <div style={{ fontSize:10, color:"#6B7280", marginTop:4, textAlign:"right" }}>次のレベルまで {need-cur} EXP</div>
      </div>

      {!adding ? (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:"#6B7280", marginBottom:10 }}>怖いことに挑んだら記録（勇気＝言う気）</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {COURAGE_RANKS.map(r=>(
              <button key={r.key} onClick={()=>setAdding(r)} style={{ background:"#1A1F2E", border:`1px solid ${r.color}44`, borderLeft:`3px solid ${r.color}`, borderRadius:8, padding:"12px 14px", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:14, fontWeight:700, color:r.color }}>{r.label}</span>
                  <span style={{ fontSize:12, color:r.color }}>+{r.exp} EXP</span>
                </div>
                <div style={{ fontSize:10, color:"#6B7280", marginTop:3 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background:"#1A1F2E", border:`1px solid ${adding.color}44`, borderRadius:10, padding:14, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:adding.color, marginBottom:8 }}>{adding.label}を撃破　+{adding.exp} EXP</div>
          <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="何に挑んだ？（任意）" style={{ ...S.input, marginBottom:10 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>addLog(adding)} style={{ ...S.btn(true,adding.color), flex:1, padding:"10px" }}>記録する</button>
            <button onClick={()=>{ setAdding(null); setMemo(""); }} style={{ ...S.btn(false), padding:"10px 16px" }}>戻る</button>
          </div>
        </div>
      )}

      <div style={{ fontSize:11, color:"#6B7280", marginBottom:8 }}>撃破ログ</div>
      {logs.length===0 ? (
        <div style={{ textAlign:"center", padding:"30px", color:"#6B7280", fontSize:13 }}>まだ記録がありません。<br/>小さな勇気から、経験値を積もう。</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {logs.map(l=>(
            <div key={l.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#1A1F2E", border:"1px solid #2E3448", borderLeft:`3px solid ${l.color}`, borderRadius:6, padding:"9px 12px" }}>
              <span style={{ fontSize:11, color:"#6B7280", minWidth:34 }}>{l.date}</span>
              <span style={{ fontSize:12, color:l.color, fontWeight:700, minWidth:44 }}>{l.label}</span>
              <span style={{ flex:1, fontSize:12, color:"#D4D8E8" }}>{l.memo||"—"}</span>
              <span style={{ fontSize:11, color:l.color }}>+{l.exp}</span>
              <button onClick={()=>delLog(l.id)} style={{ background:"transparent", border:"none", color:"#6B7280", cursor:"pointer", fontSize:12 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ShoppingList ────────────────────────────────────────────
const DEFAULT_SHOPPING = [
  { id:"s1", label:"鶏むね肉",     category:"肉・魚", fixed:true },
  { id:"s2", label:"卵",           category:"肉・魚", fixed:true },
  { id:"s3", label:"ブロッコリー", category:"野菜",   fixed:true },
  { id:"s4", label:"プロテイン",   category:"サプリ", fixed:true },
  { id:"s5", label:"オートミール", category:"主食",   fixed:true },
];
const SHOP_CAT_COLORS = { "肉・魚":"#FF6B6B", "野菜":"#34D399", "主食":"#F5C842", "サプリ":"#B5D4F4", "その他":"#A78BFA" };

function ShoppingList({ shopItems, setShopItems }) {
  const [newLabel, setNewLabel] = useState("");
  const [newCat, setNewCat] = useState("その他");
  const toggle = (id) => { const u = shopItems.map(i => i.id===id ? {...i,checked:!i.checked} : i); setShopItems(u); storageSet("sakai:shopping",u); };
  const addItem = () => {
    const label = newLabel.trim(); if (!label) return;
    const u = [...shopItems, { id:`s${Date.now()}`, label, category:newCat, fixed:false, checked:false }];
    setShopItems(u); storageSet("sakai:shopping",u); setNewLabel("");
  };
  const deleteItem = (id) => { const u = shopItems.filter(i => i.fixed || i.id!==id); setShopItems(u); storageSet("sakai:shopping",u); };
  const resetAll = () => { const u = shopItems.map(i => ({...i,checked:false})); setShopItems(u); storageSet("sakai:shopping",u); };
  const checkedCount = shopItems.filter(i=>i.checked).length;
  const cats = [...new Set(shopItems.map(i=>i.category))];
  return (
    <div>
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, color:"#555" }}>今週の買い物リスト</div>
          <div style={{ fontSize:12, color:"#34D399" }}>{checkedCount}/{shopItems.length}</div>
        </div>
        <div style={{ background:"#1A1A1A", borderRadius:20, height:5 }}>
          <div style={{ width:`${shopItems.length ? checkedCount/shopItems.length*100 : 0}%`, height:"100%", background:"#34D399", borderRadius:20, transition:"width .2s" }} />
        </div>
      </div>
      {cats.map(cat => (
        <div key={cat} style={S.card}>
          <div style={{ fontSize:11, color:SHOP_CAT_COLORS[cat]||"#555", marginBottom:8, fontWeight:700 }}>{cat}</div>
          {shopItems.filter(i=>i.category===cat).map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #0F0F0F" }}>
              <div onClick={() => toggle(item.id)} style={{ width:20, height:20, borderRadius:4, background:item.checked ? (SHOP_CAT_COLORS[cat]||"#555") : "#1A1A1A", border:`1px solid ${item.checked ? (SHOP_CAT_COLORS[cat]||"#555") : "#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0, color:"#0A0A0A", cursor:"pointer" }}>
                {item.checked && "✓"}
              </div>
              <div onClick={() => toggle(item.id)} style={{ fontSize:13, flex:1, textDecoration:item.checked ? "line-through" : "none", color:item.checked ? "#444" : "#C8C8C0", cursor:"pointer" }}>{item.label}</div>
              {!item.fixed && <button onClick={() => deleteItem(item.id)} style={{ background:"transparent", border:"none", color:"#333", cursor:"pointer", fontSize:14 }}>×</button>}
            </div>
          ))}
        </div>
      ))}
      <div style={S.card}>
        <div style={{ fontSize:12, color:"#555", marginBottom:8 }}>追加</div>
        <div style={{ display:"flex", gap:6, marginBottom:8 }}>
          <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="商品名..." style={{ ...S.input, flex:1 }} />
          <button onClick={addItem} style={{ ...S.btn(true,"#34D399"), padding:"8px 12px", flexShrink:0 }}>追加</button>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {Object.keys(SHOP_CAT_COLORS).map(c => (
            <button key={c} onClick={() => setNewCat(c)} style={{ ...S.btn(newCat===c, SHOP_CAT_COLORS[c]), fontSize:11, padding:"4px 10px" }}>{c}</button>
          ))}
        </div>
      </div>
      {checkedCount > 0 && <button onClick={resetAll} style={{ ...S.btn(false), width:"100%", padding:"10px", fontSize:12 }}>チェックをすべてリセット</button>}
    </div>
  );
}

// ─── WorkoutPanel ────────────────────────────────────────────
function WorkoutPanel({ onRecord }) {
  const [muscle, setMuscle] = useState("chest");
  const [level, setLevel] = useState(1);
  const [checked, setChecked] = useState({});
  const [recorded, setRecorded] = useState(false);
  const g = WORKOUT[muscle];
  const menu = g.levels[level];
  const totalSets = menu.sets.reduce((a,s)=>a+s.sets,0);
  const doneSets = Object.values(checked).filter(Boolean).length;
  const toggle = (key) => setChecked(p => ({...p,[key]:!p[key]}));
  const recordWorkout = () => {
    onRecord({ muscle, muscleLabel:g.label, level:level+1, levelLabel:menu.label, sets:doneSets, totalSets });
    setRecorded(true);
  };
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
        {Object.entries(WORKOUT).map(([k,g]) => (
          <button key={k} onClick={() => { setMuscle(k); setChecked({}); }} style={{ ...S.btn(muscle===k,g.color), padding:"10px 8px", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <span>{g.icon}</span><span>{g.label}</span>
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {WORKOUT[muscle].levels.map((lv,i) => (
          <button key={i} onClick={() => { setLevel(i); setChecked({}); }} style={{ ...S.btn(level===i,lv.color), flex:1, fontSize:11 }}>{lv.label}</button>
        ))}
      </div>
      <div style={{ ...S.card, borderLeft:`3px solid ${menu.color}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:2 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:menu.color }}>{g.icon} {g.label} — {menu.label}</div>
            <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{menu.sub}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:18, fontWeight:700, color:doneSets===totalSets&&totalSets>0?"#34D399":menu.color }}>{doneSets}/{totalSets}</div>
            <div style={{ fontSize:10, color:"#444" }}>セット</div>
          </div>
        </div>
        <div style={{ background:"#1A1A1A", borderRadius:20, height:4, marginTop:10, overflow:"hidden" }}>
          <div style={{ width:`${totalSets ? doneSets/totalSets*100 : 0}%`, height:"100%", background:menu.color, borderRadius:20, transition:"width .2s" }} />
        </div>
      </div>
      <div style={S.card}>
        {menu.sets.map((ex,ei) => (
          <div key={ei} style={{ marginBottom:ei<menu.sets.length-1?4:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#E8E8E0", padding:"6px 0 4px", borderBottom:"1px solid #1A1A1A" }}>
              {ex.name}<span style={{ fontSize:11, color:"#555", fontWeight:400, marginLeft:8 }}>{ex.note}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(58px, 1fr))", gap:6, paddingTop:6, paddingBottom:4 }}>
              {Array.from({length:ex.sets}).map((_,si) => {
                const key=`${ei}-${si}`; const done=checked[key];
                return (
                  <div key={si} onClick={() => toggle(key)} style={{ background:done?`${menu.color}33`:"#1A1A1A", border:`1px solid ${done?menu.color:"#2A2A2A"}`, borderRadius:4, padding:"6px 4px", cursor:"pointer", fontSize:12, color:done?menu.color:"#666", textAlign:"center", transition:"all .15s" }}>
                    {done?"✓":`${si+1}set`}<br/><span style={{ fontSize:10 }}>{ex.reps}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {doneSets>0 && <button onClick={() => setChecked({})} style={{ ...S.btn(false), width:"100%", padding:"8px", fontSize:12 }}>リセット</button>}
      {doneSets===totalSets&&totalSets>0 && (
        <div style={{ textAlign:"center", padding:"16px 0" }}>
          <div style={{ fontSize:14, color:"#34D399", marginBottom:10 }}>🎉 完了！お疲れ様でした</div>
          {!recorded ? (
            <button onClick={recordWorkout} style={{ ...S.btn(true,"#34D399"), padding:"10px 20px" }}>今日の記録として保存</button>
          ) : (
            <div style={{ fontSize:12, color:"#4ECDC4" }}>✓ カレンダーに記録しました</div>
          )}
        </div>
      )}
      {doneSets>0 && doneSets<totalSets && !recorded && (
        <button onClick={recordWorkout} style={{ ...S.btn(false), width:"100%", padding:"8px", fontSize:12, marginTop:6 }}>途中でも記録する（{doneSets}/{totalSets}セット）</button>
      )}
    </div>
  );
}

// ─── WeeklyReport ────────────────────────────────────────────
function WeeklyReport({ dayData }) {
  const days = [];
  for (let i=6; i>=0; i--) { const d=new Date(TODAY); d.setDate(TODAY.getDate()-i); days.push(dateKey(d)); }
  const actionCounts = {};
  ACTIONS.forEach(a => { actionCounts[a.id] = 0; });
  let taskTotal=0, taskDone=0;
  days.forEach(dk => {
    const dd = dayData[dk]||{};
    const acts = dd.actions||{};
    ACTIONS.forEach(a => { if (acts[a.id]) actionCounts[a.id]++; });
    taskTotal++; if (Object.values(acts).some(v=>v)) taskDone++;
  });
  const sorted = ACTIONS.map(a => ({...a, count:actionCounts[a.id]})).sort((a,b)=>b.count-a.count);
  const mvp = sorted[0]; const worst = sorted[sorted.length-1];
  const weightPoints = days.map(dk => ({ dk, w:dayData[dk]?.weight })).filter(p=>p.w);
  return (
    <div>
      {weightPoints.length >= 2 && (
        <div style={S.card}>
          <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>今週の体重推移</div>
          <svg width="100%" viewBox="0 0 300 80" style={{ display:"block", marginBottom:6 }}>
            {(() => {
              const vals=weightPoints.map(p=>p.w);
              const mn=Math.min(...vals)-0.5, mx=Math.max(...vals)+0.5, range=mx-mn||1;
              const px=(i)=>(i/(weightPoints.length-1))*270+15;
              const py=(v)=>70-((v-mn)/range)*55;
              const pts=weightPoints.map((p,i)=>`${px(i)},${py(p.w)}`).join(" ");
              return (<>
                <polyline points={pts} fill="none" stroke="#B5D4F4" strokeWidth="2"/>
                {weightPoints.map((p,i)=>(<g key={i}><circle cx={px(i)} cy={py(p.w)} r="3" fill="#B5D4F4"/><text x={px(i)} y={py(p.w)-6} textAnchor="middle" fontSize="8" fill="#B5D4F4">{p.w}</text></g>))}
                <line x1="15" y1="70" x2="285" y2="70" stroke="#1A1A1A" strokeWidth="1"/>
              </>);
            })()}
          </svg>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555" }}>
            <span>{weightPoints[0]?.w}kg</span>
            {weightPoints[weightPoints.length-1]?.w !== weightPoints[0]?.w && (
              <span style={{ color:weightPoints[weightPoints.length-1].w < weightPoints[0].w ? "#34D399" : "#FF6B6B" }}>
                {(weightPoints[weightPoints.length-1].w - weightPoints[0].w).toFixed(1)}kg
              </span>
            )}
            <span>{weightPoints[weightPoints.length-1]?.w}kg</span>
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{ fontSize:13, color:"#555", marginBottom:10 }}>今週（過去7日）のサマリー</div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <div style={{ flex:1, background:"#34D39922", border:"1px solid #34D39944", borderRadius:4, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:"#34D399", marginBottom:4 }}>MVP</div>
            <div style={{ fontSize:14 }}>{mvp.icon} {mvp.label}</div>
            <div style={{ fontSize:12, color:"#34D399" }}>{mvp.count}/7日</div>
          </div>
          <div style={{ flex:1, background:"#FF6B6B22", border:"1px solid #FF6B6B44", borderRadius:4, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:"#FF6B6B", marginBottom:4 }}>要改善</div>
            <div style={{ fontSize:14 }}>{worst.icon} {worst.label}</div>
            <div style={{ fontSize:12, color:"#FF6B6B" }}>{worst.count}/7日</div>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>アクション達成状況</div>
        {sorted.map(a => (
          <div key={a.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <div style={{ width:20, fontSize:14, textAlign:"center" }}>{a.icon}</div>
            <div style={{ flex:1, fontSize:12, color:"#C8C8C0" }}>{a.label}</div>
            <div style={{ display:"flex", gap:3 }}>
              {days.map((dk,i) => { const done=(dayData[dk]?.actions||{})[a.id]; return <div key={i} style={{ width:10, height:10, borderRadius:2, background:done?a.color:"#1A1A1A" }} />; })}
            </div>
            <div style={{ fontSize:11, color:a.color, width:28, textAlign:"right" }}>{a.count}/7</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AssetPanel ──────────────────────────────────────────────
function AssetPanel({ assets, setAssets, assetHistory, setAssetHistory, dayData }) {
  const [subTab, setSubTab] = useState("current");
  const [editAssets, setEditAssets] = useState({...assets});
  useEffect(() => { setEditAssets({...assets}); }, [assets]);

  // 今月の現金支出集計
  const thisMonth = `${TODAY.getFullYear()}-${String(TODAY.getMonth()+1).padStart(2,"0")}`;
  const monthExpenses = Object.entries(dayData||{})
    .filter(([dk]) => dk.startsWith(thisMonth))
    .flatMap(([dk, dd]) => (dd.expenses||[]).map(e => ({...e, dk})));
  const expenseTotal = monthExpenses.reduce((sum, e) => {
    const m = e.label.match(/(\d[\d,]*)円/);
    return sum + (m ? Number(m[1].replace(/,/g,"")) : 0);
  }, 0);
  const total = Object.values(editAssets).reduce((a,b)=>a+Number(b||0),0);
  const defPct = Math.min((Number(editAssets.defense)||0)/1000000*100,100);
  const saveSnapshot = () => {
    const snap = { ts:Date.now(), label:new Date().toLocaleDateString("ja-JP"), total, ...editAssets };
    const updated = [...assetHistory, snap];
    setAssetHistory(updated); storageSet("sakai:assetHistory",updated);
    setAssets({...editAssets}); storageSet("sakai:assets",editAssets);
    alert("記録しました ✓");
  };
  const deleteSnap = (ts) => { const u=assetHistory.filter(h=>h.ts!==ts); setAssetHistory(u); storageSet("sakai:assetHistory",u); };
  const histPoints = assetHistory.slice(-12);
  const nisaMonthly=50000, defMonthly=30000, rate=0.07/12;
  const simData=[];
  let sN=Number(assets.nisa||0),sD=Number(assets.defense||0),sS=Number(assets.sbi_main||0),sR=Number(assets.rakuten||0);
  for(let m=0;m<=36;m++){
    simData.push({m,total:sN+sD+sS+sR});
    sN=(sN+nisaMonthly)*(1+rate); sD=Math.min(sD+defMonthly,1000000);
  }
  const simMax=Math.max(...simData.map(d=>d.total),1);
  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        {[["current","💰 現在"],["graph","📊 グラフ"],["sim","🔮 シミュレーション"],["history","📅 履歴"],["expense","💸 支出"]].map(([k,l]) => (
          <button key={k} onClick={()=>setSubTab(k)} style={S.btn(subTab===k)}>{l}</button>
        ))}
      </div>
      {subTab==="expense" && (
        <div style={S.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:13, color:"#6B7280" }}>今月の現金支出</div>
            <div style={{ fontSize:20, fontWeight:700, color:"#C0756A" }}>{fmt(expenseTotal)}</div>
          </div>
          {monthExpenses.length===0 ? (
            <div style={{ textAlign:"center", padding:"20px", color:"#6B7280", fontSize:13 }}>今月の支出メモはまだありません</div>
          ) : (
            monthExpenses.map(e => (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid #2E3448" }}>
                <div style={{ fontSize:11, color:"#6B7280", width:48, flexShrink:0 }}>{e.dk.slice(5).replace("-","/")}</div>
                <div style={{ fontSize:13, color:"#D4D8E8" }}>{e.label}</div>
              </div>
            ))
          )}
          <div style={{ fontSize:10, color:"#6B7280", marginTop:10 }}>※「800円」のように金額を含むメモが自動集計されます</div>
        </div>
      )}
      {subTab==="current" && (
        <div style={S.card}>
          <div style={{ fontSize:13, color:"#555", marginBottom:12 }}>口座残高を入力</div>
          {ASSET_ACCOUNTS.map(a => (
            <div key={a.key} style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, color:a.color, marginBottom:4 }}>{a.label}</div>
              <input type="number" value={editAssets[a.key]||""} onChange={e=>setEditAssets(p=>({...p,[a.key]:Number(e.target.value)}))} placeholder="0" style={S.input} />
            </div>
          ))}
          <div style={{ borderTop:"1px solid #1A1A1A", paddingTop:12, marginTop:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:13, color:"#555" }}>合計</div>
              <div style={{ fontSize:20, fontWeight:700, color:"#34D399" }}>{fmt(total)}</div>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555", marginBottom:4 }}>
                <span>防衛資金進捗</span>
                <span style={{ color:"#F5C842" }}>{fmt(editAssets.defense)} / ¥1,000,000</span>
              </div>
              <div style={{ background:"#1A1A1A", borderRadius:20, height:6 }}>
                <div style={{ width:`${defPct}%`, height:"100%", background:"#F5C842", borderRadius:20, transition:"width .3s" }} />
              </div>
              <div style={{ fontSize:11, color:"#555", marginTop:4 }}>あと約{Math.max(0,Math.ceil((1000000-(Number(editAssets.defense)||0))/30000))}ヶ月（月3万積立）</div>
            </div>
            <button onClick={saveSnapshot} style={{ ...S.btn(true,"#34D399"), width:"100%", padding:"10px" }}>今日の残高を記録する</button>
          </div>
        </div>
      )}
      {subTab==="graph" && (
        <div style={S.card}>
          <div style={{ fontSize:12, color:"#555", marginBottom:12 }}>資産推移（直近12回）</div>
          {histPoints.length < 2 ? (
            <div style={{ textAlign:"center", padding:"30px", color:"#444", fontSize:13 }}>まだデータが少ないです。<br/>記録を続けると推移グラフが表示されます。</div>
          ) : (
            <>
              <svg width="100%" viewBox="0 0 300 120" style={{ display:"block", marginBottom:8 }}>
                {(() => {
                  const vals=histPoints.map(h=>h.total);
                  const mn=Math.min(...vals),mx=Math.max(...vals),range=mx-mn||1;
                  const px=(i)=>(i/(histPoints.length-1))*270+15;
                  const py=(v)=>110-((v-mn)/range)*90;
                  const pts=histPoints.map((h,i)=>`${px(i)},${py(h.total)}`).join(" ");
                  return (<>
                    <polyline points={pts} fill="none" stroke="#34D399" strokeWidth="2"/>
                    {histPoints.map((h,i)=>(<circle key={i} cx={px(i)} cy={py(h.total)} r="3" fill="#34D399"/>))}
                    <line x1="15" y1="110" x2="285" y2="110" stroke="#1A1A1A" strokeWidth="1"/>
                  </>);
                })()}
              </svg>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555" }}>
                <span>{histPoints[0]?.label}</span>
                <span style={{ color:"#34D399", fontWeight:700 }}>{fmt(histPoints[histPoints.length-1]?.total)}</span>
                <span>{histPoints[histPoints.length-1]?.label}</span>
              </div>
              {(() => { const diff=histPoints[histPoints.length-1].total-histPoints[histPoints.length-2].total; return <div style={{ marginTop:8, textAlign:"center", fontSize:13, color:diff>=0?"#34D399":"#FF6B6B" }}>前回比 {diff>=0?"+":""}{fmt(diff)}</div>; })()}
            </>
          )}
        </div>
      )}
      {subTab==="sim" && (
        <div style={S.card}>
          <div style={{ fontSize:12, color:"#555", marginBottom:4 }}>36ヶ月シミュレーション</div>
          <div style={{ fontSize:11, color:"#444", marginBottom:12 }}>NISA+5万/月・防衛+3万/月・年利7%</div>
          <svg width="100%" viewBox="0 0 300 120" style={{ display:"block", marginBottom:8 }}>
            {(() => {
              const px=(i)=>(i/36)*270+15;
              const py=(v)=>110-((v)/simMax)*90;
              const pts=simData.map((d,i)=>`${px(i)},${py(d.total)}`).join(" ");
              return (<>
                {[1000000,3000000,5000000].filter(m=>m<=simMax).map(m=>(<line key={m} x1="15" y1={py(m)} x2="285" y2={py(m)} stroke="#2A2A2A" strokeWidth="1" strokeDasharray="3,3"/>))}
                <polyline points={pts} fill="none" stroke="#B5D4F4" strokeWidth="2"/>
                <line x1="15" y1="110" x2="285" y2="110" stroke="#1A1A1A" strokeWidth="1"/>
              </>);
            })()}
          </svg>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[6,12,24,36].map(m => (
              <div key={m} style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                <span style={{ color:"#555" }}>{m}ヶ月後</span>
                <span style={{ color:"#B5D4F4", fontWeight:700 }}>{fmt(simData[m]?.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {subTab==="history" && (
        <div style={S.card}>
          <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>記録履歴</div>
          {assetHistory.length===0 ? (
            <div style={{ textAlign:"center", padding:"30px", color:"#444", fontSize:13 }}>まだ記録がありません。</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[...assetHistory].reverse().map(h => (
                <div key={h.ts} style={{ background:"#1A1A1A", borderRadius:4, padding:"10px 12px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <div style={{ fontSize:12, color:"#888" }}>{h.label}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"#34D399" }}>{fmt(h.total)}</div>
                      <button onClick={()=>deleteSnap(h.ts)} style={{ background:"transparent", border:"none", color:"#444", cursor:"pointer", fontSize:12 }}>×</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {ASSET_ACCOUNTS.map(a=>(<div key={a.key} style={{ fontSize:10, color:a.color }}>{a.label}: {fmt(h[a.key])}</div>))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DayDetail ───────────────────────────────────────────────
function DayDetail({ dk, data, onChange, onClose, height }) {
  const [tab, setTab] = useState("schedule");
  const [newSchedule, setNewSchedule] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newExpense, setNewExpense] = useState("");
  const d = data || {};
  const update = (field, val) => onChange(dk, {...d, [field]:val});

  const dObj = new Date(dk.replace(/-/g,"/"));
  const dow = dObj.getDay();
  const label = `${dObj.getMonth()+1}月${dObj.getDate()}日（${"日月火水木金土"[dow]}）${isHoliday(dk)?"🎌":""}`;

  // 仕訳スコア
  const ledgerChecked = d.ledger||{};
  const hasLedgerInput = Object.values(ledgerChecked).some(v=>v);
  const totalScore = Object.keys(LEDGER).reduce((acc,period) => {
    const {debit,credit} = LEDGER[period];
    return acc + debit.filter(i=>ledgerChecked[i.id]).reduce((a,b)=>a+b.value,0)
               + credit.filter(i=>ledgerChecked[i.id]).reduce((a,b)=>a+b.value,0);
  },0);
  // 未入力なら通常運転扱い（スコア+1）
  const effectiveScore = hasLedgerInput ? totalScore : 1;
  const mode = getMode(effectiveScore);

  const toggleLedger = (id) => update("ledger", {...ledgerChecked,[id]:!ledgerChecked[id]});
  const toggleAction = (id) => update("actions", {...(d.actions||{}),[id]:!(d.actions||{})[id]});

  const addSchedule = () => {
    const label = newSchedule.trim(); if(!label) return;
    update("schedule", [...(d.schedule||[]), {id:`sc${Date.now()}`,label,done:false}]);
    setNewSchedule("");
  };
  const toggleSchedule = (id) => update("schedule", (d.schedule||[]).map(s=>s.id===id?{...s,done:!s.done}:s));
  const deleteSchedule = (id) => update("schedule", (d.schedule||[]).filter(s=>s.id!==id));

  const addCustomTask = () => {
    const label = newTask.trim(); if(!label) return;
    update("customTasks", [...(d.customTasks||[]), {id:`ct${Date.now()}`,label,done:false}]);
    setNewTask("");
  };
  const toggleCustomTask = (id) => update("customTasks", (d.customTasks||[]).map(t=>t.id===id?{...t,done:!t.done}:t));
  const deleteCustomTask = (id) => update("customTasks", (d.customTasks||[]).filter(t=>t.id!==id));

  const addExpense = () => {
    const label = newExpense.trim(); if(!label) return;
    update("expenses", [...(d.expenses||[]), {id:`ex${Date.now()}`,label}]);
    setNewExpense("");
  };
  const deleteExpense = (id) => update("expenses", (d.expenses||[]).filter(e=>e.id!==id));

  const todayActions = getActionsForDay(dk, dow, effectiveScore);

  // BMI
  const bmi = calcBMI(d.weight, height);
  const bmiInfo = bmiLabel(bmi);

  const TABS = [["schedule","📌"],["ledger","📊"],["routine","📅"],["action","✅"],["memo","📝"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:100, overflowY:"auto" }}>
      <div style={{ ...S.app, paddingTop:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:14, paddingBottom:12, borderBottom:"1px solid #1A1A1A", marginBottom:12 }}>
          <div style={{ fontSize:15, fontWeight:700 }}>{label}</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#666", cursor:"pointer", fontSize:20 }}>✕</button>
        </div>

        {/* テーマ */}
        <div style={{ background:"#111", border:"1px solid #1A1A1A", borderLeft:"3px solid #A78BFA", borderRadius:4, padding:"10px 14px", marginBottom:12 }}>
          <div style={{ fontSize:10, color:"#A78BFA", marginBottom:4 }}>今日のテーマ</div>
          <div style={{ fontSize:13, color:"#E8E8E0" }}>「{getDailyTheme(dk)}」</div>
        </div>

        {/* タブ */}
        <div style={{ display:"flex", gap:4, marginBottom:14 }}>
          {TABS.map(([k,icon]) => (
            <button key={k} onClick={()=>setTab(k)} style={{ ...S.btn(tab===k), flex:1, fontSize:18, padding:"8px 0" }}>{icon}</button>
          ))}
        </div>
        <div style={{ fontSize:11, color:"#444", marginBottom:12 }}>
          {{"schedule":"📌 予定","ledger":"📊 仕訳","routine":"📅 ルーティン","action":"✅ アクション","memo":"📝 メモ"}[tab]}
        </div>

        {/* 予定 */}
        {tab==="schedule" && (
          <div>
            {(dow===6 || dow===0) && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#6B7280", marginBottom:8 }}>📋 {dow===6?"土":"日"}曜の定例スケジュール</div>
                {(dow===6 ? SAT_SCHEDULE : SUN_SCHEDULE).map((item,i) => {
                  const st = TYPE_STYLES[item.type];
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, background:st.bg, borderLeft:`3px solid ${st.bar}`, borderRadius:"0 4px 4px 0", padding:"8px 10px" }}>
                      <span style={{ fontSize:10, color:"#6B7280", width:64, flexShrink:0 }}>{item.time}</span>
                      <span style={{ fontSize:13 }}>{item.icon}</span>
                      <span style={{ fontSize:12, color:"#D4D8E8" }}>{item.label}</span>
                      <span style={{ fontSize:10, color:"#6B7280", marginLeft:"auto" }}>{item.sub}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={S.card}>
            <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>この日の予定</div>
            {(d.schedule||[]).length===0 && <div style={{ fontSize:13, color:"#333", textAlign:"center", padding:"20px 0" }}>予定なし</div>}
            {(d.schedule||[]).map(s => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #0F0F0F" }}>
                <div onClick={()=>toggleSchedule(s.id)} style={{ width:20, height:20, borderRadius:"50%", background:s.done?"#F5C842":"#1A1A1A", border:`1px solid ${s.done?"#F5C842":"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, flexShrink:0, color:"#0A0A0A", cursor:"pointer" }}>{s.done&&"✓"}</div>
                <div onClick={()=>toggleSchedule(s.id)} style={{ fontSize:13, flex:1, textDecoration:s.done?"line-through":"none", color:s.done?"#555":"#E8E8E0", cursor:"pointer" }}>{s.label}</div>
                <button onClick={()=>deleteSchedule(s.id)} style={{ background:"transparent", border:"none", color:"#333", cursor:"pointer", fontSize:14 }}>×</button>
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <input value={newSchedule} onChange={e=>setNewSchedule(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSchedule()} placeholder="予定を書き込む..." style={{ ...S.input, flex:1 }} />
              <button onClick={addSchedule} style={{ ...S.btn(true,"#F5C842"), padding:"8px 14px", flexShrink:0 }}>追加</button>
            </div>
          </div>
          </div>
        )}

        {/* 仕訳 */}
        {tab==="ledger" && (
          <div>
            {Object.entries(LEDGER).map(([period,{label,debit,credit}]) => (
              <div key={period} style={S.card}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>{label}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1px 1fr" }}>
                  <div style={{ paddingRight:10 }}>
                    <div style={{ fontSize:10, color:"#34D399", marginBottom:6, textAlign:"center", borderBottom:"1px solid #34D39933", paddingBottom:4 }}>借方 / プラス</div>
                    {debit.map(item => (
                      <div key={item.id} onClick={()=>toggleLedger(item.id)} style={{ display:"flex", alignItems:"flex-start", gap:6, padding:"6px 0", cursor:"pointer", borderBottom:"1px solid #0F0F0F" }}>
                        <div style={{ width:14, height:14, borderRadius:3, background:ledgerChecked[item.id]?"#34D399":"#1A1A1A", border:"1px solid #333", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#0A0A0A", marginTop:1 }}>{ledgerChecked[item.id]&&"✓"}</div>
                        <div style={{ fontSize:11, flex:1, color:ledgerChecked[item.id]?"#34D399":"#C8C8C0", lineHeight:1.4 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:"#1A1A1A" }} />
                  <div style={{ paddingLeft:10 }}>
                    <div style={{ fontSize:10, color:"#FF6B6B", marginBottom:6, textAlign:"center", borderBottom:"1px solid #FF6B6B33", paddingBottom:4 }}>貸方 / マイナス</div>
                    {credit.map(item => (
                      <div key={item.id} onClick={()=>toggleLedger(item.id)} style={{ display:"flex", alignItems:"flex-start", gap:6, padding:"6px 0", cursor:"pointer", borderBottom:"1px solid #0F0F0F" }}>
                        <div style={{ width:14, height:14, borderRadius:3, background:ledgerChecked[item.id]?"#FF6B6B":"#1A1A1A", border:"1px solid #333", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#0A0A0A", marginTop:1 }}>{ledgerChecked[item.id]&&"✓"}</div>
                        <div style={{ fontSize:11, flex:1, color:ledgerChecked[item.id]?"#FF6B6B":"#C8C8C0", lineHeight:1.4 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#555", marginBottom:4 }}>トータルスコア</div>
              <div style={{ fontSize:28, fontWeight:700, color:mode.color }}>{totalScore>0?"+":""}{totalScore}</div>
              <div style={{ fontSize:13, color:mode.color, marginTop:4 }}>{mode.label} — {mode.desc}</div>
            </div>
          </div>
        )}

        {/* ルーティン */}
        {tab==="routine" && (
          <div>
            <div style={S.card}>
              <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>仕訳スコア: <span style={{ color:mode.color, fontWeight:700 }}>{hasLedgerInput ? (totalScore>0?"+"+totalScore:totalScore) : "未入力（通常扱い）"}</span></div>
              <div style={{ background:`${mode.color}22`, border:`1px solid ${mode.color}44`, borderLeft:`3px solid ${mode.color}`, borderRadius:4, padding:"12px 14px" }}>
                <div style={{ fontSize:16, fontWeight:700, color:mode.color }}>{mode.label}</div>
                <div style={{ fontSize:12, color:"#888", marginTop:4 }}>{mode.desc}</div>
              </div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>今日の推奨アクション</div>
              {todayActions.map(a => (
                <div key={a.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"1px solid #0F0F0F" }}>
                  <div style={{ fontSize:14 }}>{a.icon}</div>
                  <div style={{ fontSize:13, color:"#C8C8C0", flex:1 }}>{a.label}</div>
                  <div style={S.tag(a.color)}>{a.category}</div>
                </div>
              ))}
              {todayActions.length===0 && <div style={{ fontSize:13, color:"#333", textAlign:"center", padding:"20px 0" }}>今日は休む日です</div>}
              <div style={{ fontSize:11, color:"#444", marginTop:10 }}>チェックは ✅ アクション タブで</div>
            </div>
          </div>
        )}

        {/* アクション */}
        {tab==="action" && (
          <div>
            {/* 体組成 */}
            <div style={S.card}>
              <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>⚖️ 体組成</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:11, color:"#B5D4F4", marginBottom:4 }}>体重 (kg)</div>
                  <input type="number" step="0.1" value={d.weight||""} onChange={e=>update("weight",e.target.value?Number(e.target.value):"")} placeholder="--.-" style={{ ...S.input, textAlign:"center", fontSize:18, fontWeight:700, color:"#B5D4F4" }} />
                </div>
                <div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>身長 {height}cm</div>
                  {bmi && bmiInfo && (
                    <div style={{ background:`${bmiInfo.color}22`, border:`1px solid ${bmiInfo.color}44`, borderRadius:4, padding:"8px 10px", textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:700, color:bmiInfo.color }}>{bmi}</div>
                      <div style={{ fontSize:10, color:bmiInfo.color }}>{bmiInfo.label}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 固定アクション */}
            <div style={S.card}>
              <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>今日のアクション</div>
              {todayActions.map(a => {
                const done = (d.actions||{})[a.id];
                return (
                  <div key={a.id} onClick={()=>toggleAction(a.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", cursor:"pointer", borderBottom:"1px solid #0F0F0F" }}>
                    <div style={{ width:20, height:20, borderRadius:4, background:done?a.color:"#1A1A1A", border:`1px solid ${done?a.color:"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0, color:"#0A0A0A" }}>{done&&"✓"}</div>
                    <div style={{ fontSize:14, flexShrink:0 }}>{a.icon}</div>
                    <div style={{ fontSize:13, flex:1, textDecoration:done?"line-through":"none", color:done?"#555":"#C8C8C0" }}>{a.label}</div>
                    <div style={S.tag(a.color)}>{a.category}</div>
                  </div>
                );
              })}
              {todayActions.length===0 && <div style={{ fontSize:13, color:"#333", textAlign:"center", padding:"20px 0" }}>今日は休む日です</div>}
            </div>

            {/* 追加タスク */}
            <div style={S.card}>
              <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>今日だけのタスク</div>
              {(d.customTasks||[]).map(t => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #0F0F0F" }}>
                  <div onClick={()=>toggleCustomTask(t.id)} style={{ width:20, height:20, borderRadius:4, background:t.done?"#A78BFA":"#1A1A1A", border:`1px solid ${t.done?"#A78BFA":"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0, color:"#0A0A0A", cursor:"pointer" }}>{t.done&&"✓"}</div>
                  <div onClick={()=>toggleCustomTask(t.id)} style={{ fontSize:13, flex:1, textDecoration:t.done?"line-through":"none", color:t.done?"#555":"#C8C8C0", cursor:"pointer" }}>{t.label}</div>
                  <button onClick={()=>deleteCustomTask(t.id)} style={{ background:"transparent", border:"none", color:"#444", cursor:"pointer", fontSize:14 }}>×</button>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomTask()} placeholder="タスクを追加..." style={{ ...S.input, flex:1 }} />
                <button onClick={addCustomTask} style={{ ...S.btn(true,"#A78BFA"), padding:"8px 14px", flexShrink:0 }}>追加</button>
              </div>
            </div>

            {/* 支出メモ */}
            <div style={S.card}>
              <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>💸 支出メモ</div>
              {(d.expenses||[]).map(e => (
                <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid #0F0F0F" }}>
                  <div style={{ fontSize:13, flex:1, color:"#C8C8C0" }}>{e.label}</div>
                  <button onClick={()=>deleteExpense(e.id)} style={{ background:"transparent", border:"none", color:"#444", cursor:"pointer", fontSize:14 }}>×</button>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <input value={newExpense} onChange={e=>setNewExpense(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addExpense()} placeholder="現金支出のみ（例：昼飯800円）" style={{ ...S.input, flex:1 }} />
                <button onClick={addExpense} style={{ ...S.btn(true,"#34D399"), padding:"8px 14px", flexShrink:0 }}>追加</button>
              </div>
            </div>
          </div>
        )}

        {/* メモ */}
        {tab==="memo" && (
          <div style={S.card}>
            <div style={{ fontSize:12, color:"#555", marginBottom:8 }}>自由メモ</div>
            <textarea value={d.memo||""} onChange={e=>update("memo",e.target.value)} placeholder="自由に書く" style={{ ...S.input, minHeight:200, resize:"vertical", lineHeight:1.8 }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────
export default function App() {
  const [mainTab, setMainTab]           = useState("calendar");
  const [selectedDay, setSelectedDay]   = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [dayData, setDayData]           = useState({});
  const [assets, setAssets]             = useState(INIT_ASSETS);
  const [assetHistory, setAssetHistory] = useState([]);
  const [shopItems, setShopItems]       = useState(DEFAULT_SHOPPING);
  const [height, setHeight]             = useState(180);
  const [showHeightEdit, setShowHeightEdit] = useState(false);
  const [noteCount, setNoteCount]       = useState(0);
  const [loaded, setLoaded]             = useState(false);

  useEffect(() => {
    const dd = storageGet("sakai:dayData", {});
    const as = storageGet("sakai:assets", INIT_ASSETS);
    const ah = storageGet("sakai:assetHistory", []);
    const sh = storageGet("sakai:shopping", DEFAULT_SHOPPING);
    const ht = storageGet("sakai:height", 180);
    const nc = storageGet("sakai:noteCount", 0);
    setDayData(dd); setAssets(as); setAssetHistory(ah); setShopItems(sh); setHeight(ht); setNoteCount(nc);
    setLoaded(true);
  }, []);

  const updateDay = useCallback((dk, data) => {
    setDayData(prev => {
      const next = {...prev, [dk]:data};
      storageSet("sakai:dayData", next);
      return next;
    });
  }, []);

  const updateHeight = (h) => {
    const v = Number(h);
    if (v > 100 && v < 250) { setHeight(v); storageSet("sakai:height", v); }
  };

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0; i<firstDow; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  const isSun = TODAY.getDay()===0;
  const isMonthEnd = TODAY.getDate()>=28;
  const showAssetBanner = mainTab==="calendar" && (isSun||isMonthEnd);

  if (!loaded) return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
      <div style={{ color:"#555", fontSize:14 }}>読込中...</div>
    </div>
  );

  return (
    <div style={S.app}>
      {/* ヘッダー */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:16, fontWeight:700, letterSpacing:2 }}>SAKAI</div>
        <div style={{ fontSize:11, color:"#444", cursor:"pointer" }} onClick={()=>setShowHeightEdit(!showHeightEdit)}>
          身長 {height}cm ✎
        </div>
      </div>

      {/* 身長編集＋バックアップ */}
      {showHeightEdit && (
        <div style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ fontSize:12, color:"#6B7280", flexShrink:0 }}>身長 (cm)</div>
            <input type="number" value={height} onChange={e=>updateHeight(e.target.value)} style={{ ...S.input, flex:1 }} />
            <button onClick={()=>setShowHeightEdit(false)} style={{ ...S.btn(true,"#34D399"), padding:"8px 12px", flexShrink:0 }}>保存</button>
          </div>
          <div style={{ borderTop:"1px solid #2E3448", paddingTop:12 }}>
            <div style={{ fontSize:11, color:"#6B7280", marginBottom:8 }}>📦 データバックアップ</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => {
                const backup = JSON.stringify({
                  dayData: storageGet("sakai:dayData",{}),
                  assets: storageGet("sakai:assets",{}),
                  assetHistory: storageGet("sakai:assetHistory",[]),
                  shopping: storageGet("sakai:shopping",[]),
                  height: storageGet("sakai:height",180),
                });
                navigator.clipboard.writeText(backup).then(() => alert("バックアップをコピーしました。メモアプリに貼り付けて保存してください。"));
              }} style={{ ...S.btn(true,"#5B9BD5"), flex:1, padding:"8px" }}>エクスポート</button>
              <button onClick={() => {
                const text = prompt("バックアップのテキストを貼り付けてください");
                if (!text) return;
                try {
                  const b = JSON.parse(text);
                  if (b.dayData) storageSet("sakai:dayData", b.dayData);
                  if (b.assets) storageSet("sakai:assets", b.assets);
                  if (b.assetHistory) storageSet("sakai:assetHistory", b.assetHistory);
                  if (b.shopping) storageSet("sakai:shopping", b.shopping);
                  if (b.height) storageSet("sakai:height", b.height);
                  alert("復元しました。ページを更新してください。");
                  window.location.reload();
                } catch { alert("形式が正しくありません"); }
              }} style={{ ...S.btn(false), flex:1, padding:"8px" }}>インポート</button>
            </div>
          </div>
        </div>
      )}

      {/* note進捗カウンター */}
      {mainTab==="calendar" && (
        <div style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:12, color:"#6B7280" }}>✍️ note進捗</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={() => { const n = Math.max(0,(noteCount||0)-1); setNoteCount(n); storageSet("sakai:noteCount",n); }} style={{ ...S.btn(false), padding:"2px 8px", fontSize:16 }}>−</button>
              <div style={{ fontSize:20, fontWeight:700, color:"#C4973A" }}>{noteCount||0}<span style={{ fontSize:12, color:"#6B7280", fontWeight:400 }}>/100</span></div>
              <button onClick={() => { const n = Math.min(100,(noteCount||0)+1); setNoteCount(n); storageSet("sakai:noteCount",n); }} style={{ ...S.btn(true,"#C4973A"), padding:"2px 8px", fontSize:16 }}>+</button>
            </div>
          </div>
          <div style={{ background:"#2E3448", borderRadius:20, height:6 }}>
            <div style={{ width:`${(noteCount||0)}%`, height:"100%", background:"#C4973A", borderRadius:20, transition:"width .3s" }} />
          </div>
        </div>
      )}
      {mainTab==="calendar" && (
        <div style={{ background:"#242938", border:"1px solid #2E3448", borderLeft:"3px solid #8B7FD4", borderRadius:4, padding:"10px 14px", marginBottom:12 }}>
          <div style={{ fontSize:10, color:"#8B7FD4", marginBottom:3 }}>今日のテーマ</div>
          <div style={{ fontSize:13, color:"#D4D8E8" }}>「{getDailyTheme(todayKey)}」</div>
        </div>
      )}

      {/* メインタブ */}
      <div style={{ display:"flex", gap:4, marginBottom:8, overflowX:"auto" }}>
        {[["calendar","🗓"],["report","📈"],["assets","💰"],["workout","💪"],["shopping","🛒"],["status","📊"],["courage","⚔️"]].map(([k,icon]) => (
          <button key={k} onClick={()=>setMainTab(k)} style={{ ...S.btn(mainTab===k), fontSize:18, padding:"8px 10px", flexShrink:0 }}>{icon}</button>
        ))}
      </div>
      <div style={{ fontSize:12, color:"#6B7280", marginBottom:12 }}>
        {{"calendar":"🗓 カレンダー","report":"📈 週次レポート","assets":"💰 資産","workout":"💪 筋トレメニュー","shopping":"🛒 買い物リスト","status":"📊 ステータス","courage":"⚔️ 勇気ログ"}[mainTab]}
      </div>

      {mainTab==="shopping" && <ShoppingList shopItems={shopItems} setShopItems={setShopItems} />}
      {mainTab==="workout"  && <WorkoutPanel onRecord={(rec) => {
        const dd = dayData[todayKey]||{};
        updateDay(todayKey, {...dd, workout:rec, actions:{...(dd.actions||{}), gym:true}});
      }} />}
      {mainTab==="report"   && <WeeklyReport dayData={dayData} />}
      {mainTab==="assets"   && <AssetPanel assets={assets} setAssets={setAssets} assetHistory={assetHistory} setAssetHistory={setAssetHistory} dayData={dayData} />}
      {mainTab==="status"   && <StatusPanel />}
      {mainTab==="courage"  && <CouragePanel />}

      {mainTab==="calendar" && (
        <>
          {showAssetBanner && (
            <div style={{ marginBottom:12, padding:"10px 12px", background:"#34D39922", border:"1px solid #34D39944", borderLeft:"3px solid #34D399", borderRadius:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, color:"#34D399", fontWeight:600 }}>💰 資産記録のタイミングです</div>
                <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{isSun?"毎週日曜の確認":"月末の記録"}</div>
              </div>
              <button onClick={()=>setMainTab("assets")} style={{ ...S.btn(true,"#34D399"), padding:"6px 12px", fontSize:11 }}>記録する</button>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <button onClick={()=>setCurrentMonth(new Date(year,month-1,1))} style={{ background:"transparent", border:"none", color:"#666", cursor:"pointer", fontSize:18 }}>‹</button>
            <div style={{ fontSize:14, fontWeight:700 }}>{year}年{month+1}月</div>
            <button onClick={()=>setCurrentMonth(new Date(year,month+1,1))} style={{ background:"transparent", border:"none", color:"#666", cursor:"pointer", fontSize:18 }}>›</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
            {["日","月","火","水","木","金","土"].map((d,i) => (
              <div key={d} style={{ textAlign:"center", fontSize:11, color:i===0?"#FF6B6B88":i===6?"#B5D4F488":"#333", paddingBottom:4 }}>{d}</div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
            {cells.map((day,idx) => {
              if (!day) return <div key={idx} />;
              const dk = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dd = dayData[dk]||{};
              const isT = dk===todayKey;
              const dow = (firstDow+day-1)%7;
              const isHol = isHoliday(dk);
              const hasSchedule = (dd.schedule||[]).length>0;
              const hasMemo = !!dd.memo;
              const hasAction = Object.values(dd.actions||{}).some(v=>v);
              const accent = dow===0||isHol ? "#FF6B6B" : dow===6 ? "#378ADD" : "#2A2A2A";
              return (
                <div key={dk} onClick={()=>setSelectedDay(dk)} style={{ background:isT?"#F5C84222":"#111", border:`1px solid ${isT?"#F5C842":"#1A1A1A"}`, borderRadius:4, padding:"5px 0", cursor:"pointer", position:"relative", minHeight:44, display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{ fontSize:13, fontWeight:isT?700:400, color:isT?"#F5C842":dow===0||isHol?"#FF6B6B88":dow===6?"#B5D4F4":"#E8E8E0", marginBottom:3 }}>{day}</div>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:accent, opacity:0.5 }} />
                  {hasSchedule && <div style={{ position:"absolute", top:3, left:3, width:4, height:4, borderRadius:"50%", background:"#F5C842" }} />}
                  {hasMemo     && <div style={{ position:"absolute", top:3, right:3, width:4, height:4, borderRadius:"50%", background:"#B5D4F4" }} />}
                  {hasAction   && <div style={{ position:"absolute", bottom:3, right:3, fontSize:8, color:"#34D399" }}>✓</div>}
                  {isHol       && <div style={{ position:"absolute", bottom:3, left:3, fontSize:8 }}>🎌</div>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:10, display:"flex", gap:10, flexWrap:"wrap" }}>
            {[["#378ADD","土"],["#FF6B6B","祝"],["#F5C842","予定"],["#B5D4F4","メモ"],["#34D399","完了"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#444" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:c }} />{l}
              </div>
            ))}
          </div>
        </>
      )}

      {selectedDay && (
        <DayDetail dk={selectedDay} data={dayData[selectedDay]} onChange={updateDay} onClose={()=>setSelectedDay(null)} height={height} />
      )}
    </div>
  );
}