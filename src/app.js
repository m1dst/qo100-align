const wsStatus = document.getElementById("wsStatus");
const wsIpInput = document.getElementById("wsIp");
const wsPortInput = document.getElementById("wsPort");
const rxSelectEl = document.getElementById("rxSelect");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const globalExitFsBtn = document.getElementById("globalExitFsBtn");
const merValueEl = document.getElementById("merValue");
const merMetaEl = document.getElementById("merMeta");
const rxMetaEl = document.getElementById("rxMeta");
const debugLogEl = document.getElementById("debugLog");
const debugPanelEl = document.querySelector(".debug-panel");
const chartLegendEl = document.getElementById("chartLegend");
const trendMerEl = document.getElementById("trendMer");
const wbStatusEl = document.getElementById("wbStatus");
const merWbStatusEl = document.getElementById("merWbStatus");
const wbFftTitleEl = document.getElementById("wbFftTitle");
const wbFftWrapEl = document.getElementById("wbFftWrap");
const wbFftCanvas = document.getElementById("wbFftCanvas");
const wbFftCtx = wbFftCanvas.getContext("2d");
const clearChartBtn = document.getElementById("clearChartBtn");
const merFullscreenBtn = document.getElementById("merFullscreenBtn");
const trendFullscreenBtn = document.getElementById("trendFullscreenBtn");
const wbFullscreenBtn = document.getElementById("wbFullscreenBtn");
const langSelectEl = document.getElementById("langSelect");
const toneEnabledEl = document.getElementById("toneEnabled");
const dishSizeSelectEl = document.getElementById("dishSizeSelect");
const toneMinMerEl = document.getElementById("toneMinMer");
const toneMaxMerEl = document.getElementById("toneMaxMer");
const canvas = document.getElementById("merChart");
const ctx = canvas.getContext("2d");

const DEMOD_MAP = {
  0: "Initializing",
  1: "Hunting",
  2: "Header",
  3: "Lock DVB-S",
  4: "Lock DVB-S2"
};

let ws;
let merPoints = [];
const maxPoints = 360;
let lastMer = null;
let audioCtx = null;
let oscillator = null;
let gainNode = null;
let canvasReady = false;
const rxOptionMap = new Map();
const debugMode = new URLSearchParams(window.location.search).has("debug");
let activeExpectedRange = null;
let batcWs = null;
let batcReconnectTimer = null;
let pseudoFullscreenEl = null;
let merRefitTimeout = null;
let lastWbStatusKey = "wb_checking";
let lastWbStatusVars = {};
let lastWbStatusLevel = "";

const DISH_MER_PRESETS = {
  "60": { min: 4.5, max: 8.5 },
  "75": { min: 5.5, max: 9.5 },
  "90": { min: 6.5, max: 10.5 },
  "100": { min: 7.0, max: 11.0 },
  "110": { min: 7.3, max: 11.3 },
  "120": { min: 7.5, max: 11.5 },
  "150": { min: 8.0, max: 12.5 }
};
const BATC_WB_WS_URL = "wss://eshail.batc.org.uk/wb/fft";
const LAST_CONN_STORAGE_KEY = "winterhillalign:last-conn";
const LANG_STORAGE_KEY = "winterhillalign:lang";
let wbFftReady = false;
let currentLang = "en";
let lastWsStatusKey = "status_disconnected";

const I18N = {
  en: { title: "QO100 Dish Calibration Tool (Winterhill)", exit_fs: "Exit Fullscreen", receiver_ip: "Receiver IP", port: "Port", receiver_source: "Receiver source", auto_rx: "Auto (highest MER)", connect: "Connect", disconnect: "Disconnect", fullscreen: "Fullscreen", mer: "MER", waiting: "Waiting for data", trend: "Trend", clear: "Clear", trend_mer: "MER: {mer} dB", audio: "Audio Tone", dish_preset: "Dish size preset", custom: "Custom / unknown", enable_tone: "Enable pitch tone based on MER", tone_map: "Tone map", to: "to", payload_debug: "Payload Debug", debug_hint: "If MER is not detected, check recent messages here and tell me what fields you see.", wb_checking: "WB occupancy: checking...", wb_beacon: "WB occupancy: beacon only (transponder appears empty)", wb_warning: "Occupancy Warning: {n} other signal(s) active", wb_unavailable: "WB occupancy: monitor unavailable", wb_reconnecting: "WB occupancy: reconnecting...", wb_fft_title: "BATC Wideband FFT (from BATC website)", status_connecting: "Connecting...", status_connected: "Connected", status_disconnected: "Disconnected", status_error: "Socket error", source: "Source", trend_label: "Trend", demod: "Demod", freq: "Freq", service: "Service", expected: "Expected MER", target: "{v} dB target", no_target: "No target" },
  zh: { title: "QO100 天线校准工具 (Winterhill)", exit_fs: "退出全屏", receiver_ip: "接收器 IP", port: "端口", receiver_source: "接收源", auto_rx: "自动（最高 MER）", connect: "连接", disconnect: "断开", fullscreen: "全屏", mer: "MER", waiting: "等待数据", trend: "趋势", clear: "清除", trend_mer: "MER：{mer} dB", audio: "音频提示", dish_preset: "天线口径预设", custom: "自定义 / 未知", enable_tone: "根据 MER 启用音调", tone_map: "音调映射", to: "到", payload_debug: "负载调试", debug_hint: "若未检测到 MER，请查看最近消息并告诉我字段。", wb_checking: "WB 占用：检查中...", wb_beacon: "WB 占用：仅信标（转发器空闲）", wb_warning: "占用警告：还有 {n} 路信号", wb_unavailable: "WB 占用：监视不可用", wb_reconnecting: "WB 占用：重连中...", status_connecting: "连接中...", status_connected: "已连接", status_disconnected: "已断开", status_error: "连接错误", source: "来源", trend_label: "趋势", demod: "解调", freq: "频率", service: "业务", expected: "期望 MER", target: "目标 {v} dB", no_target: "无目标" },
  es: { title: "Herramienta de Alineación QO100 (Winterhill)", exit_fs: "Salir de pantalla completa", receiver_ip: "IP del receptor", port: "Puerto", receiver_source: "Fuente del receptor", auto_rx: "Auto (MER más alto)", connect: "Conectar", disconnect: "Desconectar", fullscreen: "Pantalla completa", mer: "MER", waiting: "Esperando datos", trend: "Tendencia", clear: "Limpiar", trend_mer: "MER: {mer} dB", audio: "Tono de audio", dish_preset: "Preajuste de antena", custom: "Personalizado / desconocido", enable_tone: "Activar tono según MER", tone_map: "Mapa de tono", to: "a", payload_debug: "Depuración de payload", debug_hint: "Si no se detecta MER, revisa los mensajes recientes.", wb_checking: "Ocupación WB: comprobando...", wb_beacon: "Ocupación WB: solo baliza", wb_warning: "Advertencia de ocupación: {n} señal(es) activas", wb_unavailable: "Ocupación WB: monitor no disponible", wb_reconnecting: "Ocupación WB: reconectando...", status_connecting: "Conectando...", status_connected: "Conectado", status_disconnected: "Desconectado", status_error: "Error de socket", source: "Fuente", trend_label: "Tendencia", demod: "Demod", freq: "Frecuencia", service: "Servicio", expected: "MER esperado", target: "{v} dB objetivo", no_target: "Sin objetivo" },
  hi: { title: "QO100 डिश कैलिब्रेशन टूल (Winterhill)", exit_fs: "फुलस्क्रीन बंद करें", receiver_ip: "रिसीवर IP", port: "पोर्ट", receiver_source: "रिसीवर स्रोत", auto_rx: "ऑटो (सबसे ऊँचा MER)", connect: "कनेक्ट", disconnect: "डिस्कनेक्ट", fullscreen: "फुलस्क्रीन", mer: "MER", waiting: "डेटा की प्रतीक्षा", trend: "रुझान", clear: "साफ़ करें", trend_mer: "MER: {mer} dB", audio: "ऑडियो टोन", dish_preset: "डिश प्रीसेट", custom: "कस्टम / अज्ञात", enable_tone: "MER के आधार पर टोन चालू करें", tone_map: "टोन मैप", to: "से", payload_debug: "पेलोड डिबग", debug_hint: "MER न मिले तो हाल के संदेश देखें।", wb_checking: "WB व्यस्तता: जाँच जारी...", wb_beacon: "WB व्यस्तता: केवल बीकन", wb_warning: "व्यस्तता चेतावनी: {n} अन्य सिग्नल सक्रिय", wb_unavailable: "WB व्यस्तता: मॉनिटर उपलब्ध नहीं", wb_reconnecting: "WB व्यस्तता: पुनः कनेक्ट हो रहा...", status_connecting: "कनेक्ट हो रहा...", status_connected: "कनेक्टेड", status_disconnected: "डिस्कनेक्टेड", status_error: "सॉकेट त्रुटि", source: "स्रोत", trend_label: "रुझान", demod: "डीमॉड", freq: "आवृत्ति", service: "सेवा", expected: "अपेक्षित MER", target: "{v} dB लक्ष्य", no_target: "कोई लक्ष्य नहीं" },
  ar: { title: "أداة معايرة طبق QO100 (Winterhill)", exit_fs: "خروج من ملء الشاشة", receiver_ip: "IP المستقبل", port: "المنفذ", receiver_source: "مصدر المستقبل", auto_rx: "تلقائي (أعلى MER)", connect: "اتصال", disconnect: "قطع الاتصال", fullscreen: "ملء الشاشة", mer: "MER", waiting: "بانتظار البيانات", trend: "الاتجاه", clear: "مسح", trend_mer: "MER: {mer} dB", audio: "نغمة صوتية", dish_preset: "إعداد الطبق", custom: "مخصص / غير معروف", enable_tone: "تفعيل النغمة حسب MER", tone_map: "نطاق النغمة", to: "إلى", payload_debug: "تصحيح الحمولة", debug_hint: "إذا لم يُكتشف MER راجع الرسائل الأخيرة.", wb_checking: "إشغال WB: جارٍ الفحص...", wb_beacon: "إشغال WB: إشارة المنارة فقط", wb_warning: "تحذير إشغال: {n} إشارات أخرى نشطة", wb_unavailable: "إشغال WB: المراقبة غير متاحة", wb_reconnecting: "إشغال WB: إعادة اتصال...", status_connecting: "جارٍ الاتصال...", status_connected: "متصل", status_disconnected: "غير متصل", status_error: "خطأ بالمقبس", source: "المصدر", trend_label: "الاتجاه", demod: "إزالة التضمين", freq: "التردد", service: "الخدمة", expected: "MER المتوقع", target: "هدف {v} dB", no_target: "لا هدف" },
  bn: { title: "QO100 ডিশ ক্যালিব্রেশন টুল (Winterhill)", exit_fs: "ফুলস্ক্রিন বন্ধ", receiver_ip: "রিসিভার IP", port: "পোর্ট", receiver_source: "রিসিভার উৎস", auto_rx: "অটো (সর্বোচ্চ MER)", connect: "সংযোগ", disconnect: "বিচ্ছিন্ন", fullscreen: "ফুলস্ক্রিন", mer: "MER", waiting: "ডেটার জন্য অপেক্ষা", trend: "ট্রেন্ড", clear: "মুছুন", trend_mer: "MER: {mer} dB", audio: "অডিও টোন", dish_preset: "ডিশ প্রিসেট", custom: "কাস্টম / অজানা", enable_tone: "MER অনুযায়ী টোন চালু", tone_map: "টোন ম্যাপ", to: "থেকে", payload_debug: "পেলোড ডিবাগ", debug_hint: "MER না পেলে সাম্প্রতিক মেসেজ দেখুন।", wb_checking: "WB দখল: পরীক্ষা চলছে...", wb_beacon: "WB দখল: শুধু বীকন", wb_warning: "দখল সতর্কতা: আরও {n} সিগন্যাল সক্রিয়", wb_unavailable: "WB দখল: মনিটর অনুপলব্ধ", wb_reconnecting: "WB দখল: পুনরায় সংযোগ...", status_connecting: "সংযোগ হচ্ছে...", status_connected: "সংযুক্ত", status_disconnected: "বিচ্ছিন্ন", status_error: "সকেট ত্রুটি", source: "উৎস", trend_label: "ট্রেন্ড", demod: "ডিমড", freq: "ফ্রিকোয়েন্সি", service: "সার্ভিস", expected: "প্রত্যাশিত MER", target: "{v} dB লক্ষ্য", no_target: "লক্ষ্য নেই" },
  pt: { title: "Ferramenta de Calibração QO100 (Winterhill)", exit_fs: "Sair da tela cheia", receiver_ip: "IP do receptor", port: "Porta", receiver_source: "Fonte do receptor", auto_rx: "Auto (MER mais alto)", connect: "Conectar", disconnect: "Desconectar", fullscreen: "Tela cheia", mer: "MER", waiting: "Aguardando dados", trend: "Tendência", clear: "Limpar", trend_mer: "MER: {mer} dB", audio: "Tom de áudio", dish_preset: "Preset da antena", custom: "Personalizado / desconhecido", enable_tone: "Ativar tom por MER", tone_map: "Mapa de tom", to: "até", payload_debug: "Debug de payload", debug_hint: "Se MER não for detectado, veja mensagens recentes.", wb_checking: "Ocupação WB: verificando...", wb_beacon: "Ocupação WB: apenas beacon", wb_warning: "Aviso de ocupação: {n} outro(s) sinal(is) ativo(s)", wb_unavailable: "Ocupação WB: monitor indisponível", wb_reconnecting: "Ocupação WB: reconectando...", status_connecting: "Conectando...", status_connected: "Conectado", status_disconnected: "Desconectado", status_error: "Erro de socket", source: "Fonte", trend_label: "Tendência", demod: "Demod", freq: "Freq", service: "Serviço", expected: "MER esperado", target: "alvo {v} dB", no_target: "Sem alvo" },
  ru: { title: "Инструмент калибровки QO100 (Winterhill)", exit_fs: "Выйти из полноэкранного", receiver_ip: "IP приёмника", port: "Порт", receiver_source: "Источник приёмника", auto_rx: "Авто (макс. MER)", connect: "Подключить", disconnect: "Отключить", fullscreen: "Полный экран", mer: "MER", waiting: "Ожидание данных", trend: "Тренд", clear: "Очистить", trend_mer: "MER: {mer} dB", audio: "Аудио тон", dish_preset: "Профиль тарелки", custom: "Пользовательский / неизвестно", enable_tone: "Включить тон по MER", tone_map: "Диапазон тона", to: "до", payload_debug: "Отладка payload", debug_hint: "Если MER не найден, посмотрите последние сообщения.", wb_checking: "Занятость WB: проверка...", wb_beacon: "Занятость WB: только маяк", wb_warning: "Предупреждение: активны ещё {n} сигнал(ов)", wb_unavailable: "Занятость WB: монитор недоступен", wb_reconnecting: "Занятость WB: переподключение...", status_connecting: "Подключение...", status_connected: "Подключено", status_disconnected: "Отключено", status_error: "Ошибка сокета", source: "Источник", trend_label: "Тренд", demod: "Демод", freq: "Частота", service: "Сервис", expected: "Ожидаемый MER", target: "цель {v} dB", no_target: "Нет цели" },
  ja: { title: "QO100 ディッシュ校正ツール (Winterhill)", exit_fs: "全画面終了", receiver_ip: "受信機 IP", port: "ポート", receiver_source: "受信ソース", auto_rx: "自動（最高 MER）", connect: "接続", disconnect: "切断", fullscreen: "全画面", mer: "MER", waiting: "データ待機中", trend: "トレンド", clear: "クリア", trend_mer: "MER: {mer} dB", audio: "音声トーン", dish_preset: "アンテナプリセット", custom: "カスタム / 不明", enable_tone: "MER に応じてトーンを有効化", tone_map: "トーン範囲", to: "〜", payload_debug: "ペイロードデバッグ", debug_hint: "MER が取れない場合は最新メッセージを確認。", wb_checking: "WB 占有: 確認中...", wb_beacon: "WB 占有: ビーコンのみ", wb_warning: "占有警告: 他に {n} 信号がアクティブ", wb_unavailable: "WB 占有: 監視不可", wb_reconnecting: "WB 占有: 再接続中...", status_connecting: "接続中...", status_connected: "接続済み", status_disconnected: "未接続", status_error: "ソケットエラー", source: "ソース", trend_label: "トレンド", demod: "復調", freq: "周波数", service: "サービス", expected: "想定 MER", target: "目標 {v} dB", no_target: "目標なし" },
  pa: { title: "QO100 ਡਿਸ਼ ਕੈਲੀਬ੍ਰੇਸ਼ਨ ਟੂਲ (Winterhill)", exit_fs: "ਫੁੱਲਸਕ੍ਰੀਨ ਬੰਦ ਕਰੋ", receiver_ip: "ਰੀਸੀਵਰ IP", port: "ਪੋਰਟ", receiver_source: "ਰੀਸੀਵਰ ਸਰੋਤ", auto_rx: "ਆਟੋ (ਸਭ ਤੋਂ ਉੱਚਾ MER)", connect: "ਕਨੈਕਟ", disconnect: "ਡਿਸਕਨੈਕਟ", fullscreen: "ਫੁੱਲਸਕ੍ਰੀਨ", mer: "MER", waiting: "ਡਾਟਾ ਦੀ ਉਡੀਕ", trend: "ਰੁਝਾਨ", clear: "ਸਾਫ਼", trend_mer: "MER: {mer} dB", audio: "ਆਡੀਓ ਟੋਨ", dish_preset: "ਡਿਸ਼ ਪ੍ਰੀਸੈਟ", custom: "ਕਸਟਮ / ਅਣਜਾਣ", enable_tone: "MER ਅਧਾਰਿਤ ਟੋਨ ਚਾਲੂ", tone_map: "ਟੋਨ ਮੈਪ", to: "ਤੋਂ", payload_debug: "ਪੇਲੋਡ ਡੀਬੱਗ", debug_hint: "ਜੇ MER ਨਾ ਮਿਲੇ ਤਾਂ ਹਾਲੀਆ ਸੁਨੇਹੇ ਵੇਖੋ।", wb_checking: "WB ਭਰਾਵਟ: ਜਾਂਚ ਜਾਰੀ...", wb_beacon: "WB ਭਰਾਵਟ: ਸਿਰਫ਼ ਬੀਕਨ", wb_warning: "ਭਰਾਵਟ ਚੇਤਾਵਨੀ: ਹੋਰ {n} ਸਿਗਨਲ ਐਕਟਿਵ", wb_unavailable: "WB ਭਰਾਵਟ: ਮਾਨੀਟਰ ਉਪਲਬਧ ਨਹੀਂ", wb_reconnecting: "WB ਭਰਾਵਟ: ਮੁੜ ਕਨੈਕਟ...", status_connecting: "ਕਨੈਕਟ ਹੋ ਰਿਹਾ...", status_connected: "ਕਨੈਕਟਡ", status_disconnected: "ਡਿਸਕਨੈਕਟਡ", status_error: "ਸਾਕੇਟ ਗਲਤੀ", source: "ਸਰੋਤ", trend_label: "ਰੁਝਾਨ", demod: "ਡੀਮੋਡ", freq: "ਫ੍ਰਿਕਵੈਂਸੀ", service: "ਸੇਵਾ", expected: "ਉਮੀਦਿਤ MER", target: "{v} dB ਟਾਰਗੇਟ", no_target: "ਕੋਈ ਟਾਰਗੇਟ ਨਹੀਂ" },
  de: { title: "QO100 Schüssel-Kalibrierung (Winterhill)", exit_fs: "Vollbild beenden", receiver_ip: "Empfänger-IP", port: "Port", receiver_source: "Empfängerquelle", auto_rx: "Auto (höchster MER)", connect: "Verbinden", disconnect: "Trennen", fullscreen: "Vollbild", mer: "MER", waiting: "Warte auf Daten", trend: "Trend", clear: "Löschen", trend_mer: "MER: {mer} dB", audio: "Audioton", dish_preset: "Schüsselgröße", custom: "Benutzerdefiniert / unbekannt", enable_tone: "Tonhöhe nach MER aktivieren", tone_map: "Tonbereich", to: "bis", payload_debug: "Payload-Debug", debug_hint: "Wenn kein MER erkannt wird, prüfe die letzten Meldungen.", wb_checking: "WB-Belegung: wird geprüft...", wb_beacon: "WB-Belegung: nur Bake (Transponder leer)", wb_warning: "Belegungswarnung: {n} weitere Signale aktiv", wb_unavailable: "WB-Belegung: Monitor nicht verfügbar", wb_reconnecting: "WB-Belegung: erneute Verbindung...", status_connecting: "Verbinde...", status_connected: "Verbunden", status_disconnected: "Getrennt", status_error: "Socket-Fehler", source: "Quelle", trend_label: "Trend", demod: "Demod", freq: "Freq", service: "Service", expected: "Erwarteter MER", target: "{v} dB Ziel", no_target: "Kein Ziel" },
  fr: { title: "Outil de Calibrage QO100 (Winterhill)", exit_fs: "Quitter le plein écran", receiver_ip: "IP du récepteur", port: "Port", receiver_source: "Source du récepteur", auto_rx: "Auto (MER le plus élevé)", connect: "Connecter", disconnect: "Déconnecter", fullscreen: "Plein écran", mer: "MER", waiting: "En attente de données", trend: "Tendance", clear: "Effacer", trend_mer: "MER : {mer} dB", audio: "Ton audio", dish_preset: "Taille de parabole", custom: "Personnalisé / inconnu", enable_tone: "Activer la tonalité selon le MER", tone_map: "Plage de tonalité", to: "à", payload_debug: "Debug payload", debug_hint: "Si le MER n'est pas détecté, vérifiez les derniers messages.", wb_checking: "Occupation WB : vérification...", wb_beacon: "Occupation WB : balise seule (transpondeur vide)", wb_warning: "Alerte d'occupation : {n} autre(s) signal(aux) actif(s)", wb_unavailable: "Occupation WB : moniteur indisponible", wb_reconnecting: "Occupation WB : reconnexion...", status_connecting: "Connexion...", status_connected: "Connecté", status_disconnected: "Déconnecté", status_error: "Erreur socket", source: "Source", trend_label: "Tendance", demod: "Démod", freq: "Fréq", service: "Service", expected: "MER attendu", target: "cible {v} dB", no_target: "Aucune cible" },
  it: { title: "Strumento Calibrazione QO100 (Winterhill)", exit_fs: "Esci da schermo intero", receiver_ip: "IP ricevitore", port: "Porta", receiver_source: "Sorgente ricevitore", auto_rx: "Auto (MER più alto)", connect: "Connetti", disconnect: "Disconnetti", fullscreen: "Schermo intero", mer: "MER", waiting: "In attesa di dati", trend: "Trend", clear: "Cancella", trend_mer: "MER: {mer} dB", audio: "Tono audio", dish_preset: "Dimensione parabola", custom: "Personalizzato / sconosciuto", enable_tone: "Abilita tono in base al MER", tone_map: "Mappa tono", to: "a", payload_debug: "Debug payload", debug_hint: "Se MER non viene rilevato, controlla i messaggi recenti.", wb_checking: "Occupazione WB: controllo in corso...", wb_beacon: "Occupazione WB: solo beacon (transponder libero)", wb_warning: "Avviso occupazione: {n} altri segnali attivi", wb_unavailable: "Occupazione WB: monitor non disponibile", wb_reconnecting: "Occupazione WB: riconnessione...", status_connecting: "Connessione...", status_connected: "Connesso", status_disconnected: "Disconnesso", status_error: "Errore socket", source: "Sorgente", trend_label: "Trend", demod: "Demod", freq: "Freq", service: "Servizio", expected: "MER atteso", target: "target {v} dB", no_target: "Nessun target" },
  nl: { title: "QO100 Schotel Uitlijntool (Winterhill)", exit_fs: "Volledig scherm afsluiten", receiver_ip: "Ontvanger-IP", port: "Poort", receiver_source: "Ontvangerbron", auto_rx: "Auto (hoogste MER)", connect: "Verbinden", disconnect: "Verbreken", fullscreen: "Volledig scherm", mer: "MER", waiting: "Wachten op data", trend: "Trend", clear: "Wissen", trend_mer: "MER: {mer} dB", audio: "Audiotoon", dish_preset: "Schotelgrootte", custom: "Aangepast / onbekend", enable_tone: "Toonhoogte op basis van MER inschakelen", tone_map: "Toonbereik", to: "tot", payload_debug: "Payload-debug", debug_hint: "Als MER niet wordt gedetecteerd, bekijk recente berichten.", wb_checking: "WB-bezetting: controleren...", wb_beacon: "WB-bezetting: alleen baken (transponder lijkt leeg)", wb_warning: "Bezettingswaarschuwing: {n} ander(e) signaal/signalen actief", wb_unavailable: "WB-bezetting: monitor niet beschikbaar", wb_reconnecting: "WB-bezetting: opnieuw verbinden...", status_connecting: "Verbinden...", status_connected: "Verbonden", status_disconnected: "Verbroken", status_error: "Socketfout", source: "Bron", trend_label: "Trend", demod: "Demod", freq: "Freq", service: "Service", expected: "Verwachte MER", target: "{v} dB doel", no_target: "Geen doel" },
  pl: { title: "Narzędzie Kalibracji QO100 (Winterhill)", exit_fs: "Wyjdź z pełnego ekranu", receiver_ip: "IP odbiornika", port: "Port", receiver_source: "Źródło odbiornika", auto_rx: "Auto (najwyższy MER)", connect: "Połącz", disconnect: "Rozłącz", fullscreen: "Pełny ekran", mer: "MER", waiting: "Oczekiwanie na dane", trend: "Trend", clear: "Wyczyść", trend_mer: "MER: {mer} dB", audio: "Ton audio", dish_preset: "Rozmiar czaszy", custom: "Niestandardowe / nieznane", enable_tone: "Włącz ton zależny od MER", tone_map: "Zakres tonu", to: "do", payload_debug: "Debug payload", debug_hint: "Jeśli MER nie jest wykrywany, sprawdź ostatnie komunikaty.", wb_checking: "Zajętość WB: sprawdzanie...", wb_beacon: "Zajętość WB: tylko beacon (transponder pusty)", wb_warning: "Ostrzeżenie zajętości: aktywne jeszcze {n} sygnały", wb_unavailable: "Zajętość WB: monitor niedostępny", wb_reconnecting: "Zajętość WB: ponowne łączenie...", status_connecting: "Łączenie...", status_connected: "Połączono", status_disconnected: "Rozłączono", status_error: "Błąd gniazda", source: "Źródło", trend_label: "Trend", demod: "Demod", freq: "Częst.", service: "Usługa", expected: "Oczekiwany MER", target: "{v} dB cel", no_target: "Brak celu" },
  tr: { title: "QO100 Çanak Kalibrasyon Aracı (Winterhill)", exit_fs: "Tam ekrandan çık", receiver_ip: "Alıcı IP", port: "Port", receiver_source: "Alıcı kaynağı", auto_rx: "Otomatik (en yüksek MER)", connect: "Bağlan", disconnect: "Bağlantıyı kes", fullscreen: "Tam ekran", mer: "MER", waiting: "Veri bekleniyor", trend: "Trend", clear: "Temizle", trend_mer: "MER: {mer} dB", audio: "Ses tonu", dish_preset: "Çanak boyutu", custom: "Özel / bilinmiyor", enable_tone: "MER'e göre perdeyi etkinleştir", tone_map: "Ton aralığı", to: "ile", payload_debug: "Payload hata ayıklama", debug_hint: "MER algılanmazsa son mesajları kontrol edin.", wb_checking: "WB doluluğu: kontrol ediliyor...", wb_beacon: "WB doluluğu: sadece beacon (transponder boş görünüyor)", wb_warning: "Doluluk uyarısı: {n} diğer sinyal aktif", wb_unavailable: "WB doluluğu: izleme kullanılamıyor", wb_reconnecting: "WB doluluğu: yeniden bağlanıyor...", status_connecting: "Bağlanıyor...", status_connected: "Bağlı", status_disconnected: "Bağlı değil", status_error: "Soket hatası", source: "Kaynak", trend_label: "Trend", demod: "Demod", freq: "Frek", service: "Servis", expected: "Beklenen MER", target: "{v} dB hedef", no_target: "Hedef yok" },
  uk: { title: "Інструмент Калібрування QO100 (Winterhill)", exit_fs: "Вийти з повного екрана", receiver_ip: "IP приймача", port: "Порт", receiver_source: "Джерело приймача", auto_rx: "Авто (найвищий MER)", connect: "Підключити", disconnect: "Відключити", fullscreen: "Повний екран", mer: "MER", waiting: "Очікування даних", trend: "Тренд", clear: "Очистити", trend_mer: "MER: {mer} dB", audio: "Аудіотон", dish_preset: "Розмір антени", custom: "Користувацький / невідомо", enable_tone: "Увімкнути тон за MER", tone_map: "Діапазон тону", to: "до", payload_debug: "Налагодження payload", debug_hint: "Якщо MER не виявлено, перевірте останні повідомлення.", wb_checking: "Зайнятість WB: перевірка...", wb_beacon: "Зайнятість WB: лише маяк (транспондер порожній)", wb_warning: "Попередження зайнятості: активні ще {n} сигнал(ів)", wb_unavailable: "Зайнятість WB: монітор недоступний", wb_reconnecting: "Зайнятість WB: перепідключення...", status_connecting: "Підключення...", status_connected: "Підключено", status_disconnected: "Відключено", status_error: "Помилка сокета", source: "Джерело", trend_label: "Тренд", demod: "Демод", freq: "Част.", service: "Сервіс", expected: "Очікуваний MER", target: "ціль {v} dB", no_target: "Немає цілі" }
};

function t(key, vars = {}) {
  const dict = I18N[currentLang] || I18N.en;
  let s = dict[key] ?? I18N.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

function formatNumber(value, options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const locale = I18N[currentLang] ? currentLang : "en";
  const fmt = new Intl.NumberFormat(locale, options);
  return fmt.format(n);
}

function applyLanguage(lang) {
  currentLang = I18N[lang] ? lang : "en";
  localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

  document.title = t("title");
  globalExitFsBtn.textContent = t("exit_fs");
  document.querySelector(".connect-panel .panel-head h2").textContent = t("title");
  document.querySelector("label[for='wsIp']").textContent = t("receiver_ip");
  document.querySelector("label[for='wsPort']").textContent = t("port");
  document.querySelector("label[for='rxSelect']").textContent = t("receiver_source");
  document.querySelector("#rxSelect option[value='-1']").textContent = t("auto_rx");
  connectBtn.textContent = t("connect");
  disconnectBtn.textContent = t("disconnect");
  wbFullscreenBtn.textContent = t("fullscreen");
  document.querySelector(".mer-panel h2").textContent = t("mer");
  merFullscreenBtn.textContent = t("fullscreen");
  document.querySelector(".chart-panel h2").textContent = t("trend");
  trendFullscreenBtn.textContent = t("fullscreen");
  clearChartBtn.textContent = t("clear");
  trendMerEl.textContent = t("trend_mer", { mer: "--" });
  document.querySelector(".audio-panel h2").textContent = t("audio");
  document.querySelector("label[for='dishSizeSelect']").textContent = t("dish_preset");
  document.querySelector("#dishSizeSelect option[value='custom']").textContent = t("custom");
  document.querySelector(".switch-row span").textContent = t("enable_tone");
  document.querySelector("label[for='toneMinMer']").textContent = t("tone_map");
  document.querySelector(".tone-map-row span").textContent = t("to");
  document.querySelector(".debug-panel h2").textContent = t("payload_debug");
  document.querySelector(".hint").textContent = t("debug_hint");
  if (wbFftTitleEl) wbFftTitleEl.textContent = t("wb_fft_title");
  wbStatusEl.title = t("wb_checking");

  setStatusKey(lastWsStatusKey, lastWsStatusKey === "status_connected");
  setWbStatusKey(lastWbStatusKey, lastWbStatusVars, lastWbStatusLevel);
  updateChartLegend();
  drawChart();
  if (lastMer !== null && Number.isFinite(lastMer)) {
    updateMer(lastMer, merValueEl.dataset.lastSource || "unknown", merValueEl._lastRx || null);
  }
  applyDishPreset();
}

function setUiConnected(isConnected) {
  document.body.classList.toggle("disconnected", !isConnected);
}

function setStatus(text, ok = false) {
  if (!wsStatus) return;
  wsStatus.textContent = text;
  wsStatus.style.background = ok ? "#1f9f57" : "#00000055";
}

function setStatusKey(key, ok = false) {
  lastWsStatusKey = key;
  setStatus(t(key), ok);
}

function loadLastConnection() {
  try {
    const raw = localStorage.getItem(LAST_CONN_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object") {
      if (typeof saved.ip === "string" && saved.ip.trim()) {
        wsIpInput.value = saved.ip.trim();
      }
      if (typeof saved.port === "string" && saved.port.trim()) {
        wsPortInput.value = saved.port.trim();
      } else if (typeof saved.port === "number" && Number.isFinite(saved.port)) {
        wsPortInput.value = String(saved.port);
      }
    }
  } catch {}
}

function saveLastConnection(ip, port) {
  try {
    localStorage.setItem(LAST_CONN_STORAGE_KEY, JSON.stringify({ ip, port }));
  } catch {}
}

function isIOSLike() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function disableIOSZoomGestures() {
  if (!isIOSLike()) return;

  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

  // Block pinch zoom via touch events
  document.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // Block double-tap zoom (but do not interfere with button/input controls)
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
}

function updateDynamicViewportHeightVar() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-dvh", `${Math.round(vh)}px`);
}

function fitMerValueToWidth() {
  if (!merValueEl) return;
  const parent = merValueEl.parentElement;
  if (!parent) return;
  // Keep a safety gutter so glyphs never clip at the card edge on mobile.
  const available = Math.max(10, parent.clientWidth - 24);
  const text = (merValueEl.textContent || "").trim();
  if (!text) return;

  const style = getComputedStyle(merValueEl);
  const family = style.fontFamily || "sans-serif";
  const weight = style.fontWeight || "900";
  const letterSpacing = parseFloat(style.letterSpacing || "0");

  const canvasMeasure = fitMerValueToWidth._canvas || (fitMerValueToWidth._canvas = document.createElement("canvas"));
  const mctx = canvasMeasure.getContext("2d");
  if (!mctx) return;

  const measure = (sizePx) => {
    mctx.font = `${weight} ${sizePx}px ${family}`;
    const baseWidth = mctx.measureText(text).width;
    // Negative tracking can cause underestimation and clipping; ignore it for fit math.
    const spacing = Number.isFinite(letterSpacing)
      ? Math.max(0, letterSpacing) * Math.max(0, text.length - 1)
      : 0;
    return baseWidth + spacing;
  };

  let low = 24;
  let high = Math.max(24, Math.floor(window.innerHeight * 0.9));
  let best = low;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (measure(mid) <= available) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const heightCap = Math.max(28, Math.floor(parent.clientHeight * 0.70));
  merValueEl.style.fontSize = `${Math.min(best, heightCap)}px`;
}

function scheduleMerRefitBurst() {
  // Rotation/layout settles across a few frames on iOS; refit repeatedly.
  requestAnimationFrame(() => {
    fitMerValueToWidth();
    requestAnimationFrame(() => {
      fitMerValueToWidth();
      requestAnimationFrame(() => {
        fitMerValueToWidth();
      });
    });
  });

  if (merRefitTimeout) clearTimeout(merRefitTimeout);
  merRefitTimeout = setTimeout(() => {
    fitMerValueToWidth();
  }, 120);
}

function enterPseudoFullscreen(element) {
  if (pseudoFullscreenEl === element) return;
  if (pseudoFullscreenEl) pseudoFullscreenEl.classList.remove("pseudo-fullscreen");
  pseudoFullscreenEl = element;
  pseudoFullscreenEl.classList.add("pseudo-fullscreen");
  document.body.classList.add("pseudo-fullscreen-active");
  globalExitFsBtn.hidden = false;
  // iOS Safari portrait can keep old scroll offset; force top for reliable full-viewport overlay.
  window.scrollTo(0, 0);
}

function exitPseudoFullscreen() {
  if (!pseudoFullscreenEl) return;
  pseudoFullscreenEl.classList.remove("pseudo-fullscreen");
  pseudoFullscreenEl = null;
  document.body.classList.remove("pseudo-fullscreen-active");
  if (!document.fullscreenElement) globalExitFsBtn.hidden = true;
}

async function exitAnyFullscreen() {
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch {}
  }
  exitPseudoFullscreen();
  globalExitFsBtn.hidden = true;
  resizeChartCanvas();
  if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
}

function setWbStatus(text, level = "") {
  const warningPrefix = `${t("wb_warning", { n: "__N__" }).split("__N__")[0]}`;
  const display = warningPrefix ? text.replace(warningPrefix, `${warningPrefix}<wbr> `) : text;
  wbStatusEl.innerHTML = display;
  wbStatusEl.classList.remove("ok", "warn");
  if (level) wbStatusEl.classList.add(level);

  merWbStatusEl.innerHTML = display;
  merWbStatusEl.classList.remove("ok", "warn");
  if (level) merWbStatusEl.classList.add(level);
}

function setWbStatusKey(key, vars = {}, level = "") {
  lastWbStatusKey = key;
  lastWbStatusVars = vars;
  lastWbStatusLevel = level;
  setWbStatus(t(key, vars), level);
}

function resizeWbFftCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(wbFftCanvas.clientWidth));
  const h = Math.max(1, Math.floor(wbFftCanvas.clientHeight));
  const tw = Math.floor(w * dpr);
  const th = Math.floor(h * dpr);
  if (wbFftCanvas.width !== tw || wbFftCanvas.height !== th) {
    wbFftCanvas.width = tw;
    wbFftCanvas.height = th;
  }
  wbFftCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wbFftReady = true;
}

async function toggleFullscreenFor(element) {
  const mustUsePseudo = isIOSLike() || !document.fullscreenEnabled || !element.requestFullscreen;

  if (mustUsePseudo) {
    if (pseudoFullscreenEl === element) exitPseudoFullscreen();
    else enterPseudoFullscreen(element);
    resizeChartCanvas();
    if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
    return;
  }

  try {
    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    await element.requestFullscreen();

    // Some Safari/iOS builds expose API but do not actually enter fullscreen.
    setTimeout(() => {
      if (document.fullscreenElement !== element) {
        enterPseudoFullscreen(element);
        resizeChartCanvas();
        if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
      }
    }, 120);
  } catch {
    enterPseudoFullscreen(element);
    resizeChartCanvas();
    if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
    addDebug("fullscreen fallback active");
  }
}

function drawWbFft(fftData) {
  if (!wbFftReady || !fftData || !fftData.length) return;
  const w = wbFftCanvas.clientWidth;
  const h = wbFftCanvas.clientHeight;
  wbFftCtx.clearRect(0, 0, w, h);

  wbFftCtx.fillStyle = "#000000";
  wbFftCtx.fillRect(0, 0, w, h);

  // BATC-like dotted grid
  wbFftCtx.strokeStyle = "#3c4854";
  wbFftCtx.lineWidth = 1;
  wbFftCtx.setLineDash([3, 6]);
  for (let i = 1; i <= 4; i++) {
    const y = (h * i) / 5;
    wbFftCtx.beginPath();
    wbFftCtx.moveTo(0, y);
    wbFftCtx.lineTo(w, y);
    wbFftCtx.stroke();
  }
  for (let i = 1; i <= 8; i++) {
    const x = (w * i) / 9;
    wbFftCtx.beginPath();
    wbFftCtx.moveTo(x, 0);
    wbFftCtx.lineTo(x, h);
    wbFftCtx.stroke();
  }
  wbFftCtx.setLineDash([]);

  // Beacon marker at 10,491.5 = 491.5 relative to 490.5-499.5 span
  const beaconX = ((491.5 - 490.5) / 9.0) * w;
  wbFftCtx.strokeStyle = "#9aa8b3";
  wbFftCtx.setLineDash([6, 6]);
  wbFftCtx.beginPath();
  wbFftCtx.moveTo(beaconX, 0);
  wbFftCtx.lineTo(beaconX, h);
  wbFftCtx.stroke();
  wbFftCtx.setLineDash([]);

  // Build trace
  const len = fftData.length;
  const trace = new Array(w);
  for (let x = 0; x < w; x++) {
    const idx = Math.min(len - 1, Math.floor((x / Math.max(1, w - 1)) * len));
    const sample = fftData[idx] / 65535;
    const y = h - Math.min(1, sample) * h;
    trace[x] = y;
  }

  // Filled spectrum area (blue/purple)
  const grad = wbFftCtx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0.0, "#49a8ea");
  grad.addColorStop(0.45, "#6ea2db");
  grad.addColorStop(1.0, "#b285c6");
  wbFftCtx.fillStyle = grad;
  wbFftCtx.beginPath();
  wbFftCtx.moveTo(0, h);
  for (let x = 0; x < w; x++) {
    wbFftCtx.lineTo(x, trace[x]);
  }
  wbFftCtx.lineTo(w - 1, h);
  wbFftCtx.closePath();
  wbFftCtx.fill();

  // Top outline
  wbFftCtx.strokeStyle = "#8cc5f3";
  wbFftCtx.lineWidth = 1.2;
  wbFftCtx.beginPath();
  for (let x = 0; x < w; x++) {
    if (x === 0) wbFftCtx.moveTo(x, trace[x]);
    else wbFftCtx.lineTo(x, trace[x]);
  }
  wbFftCtx.stroke();

}

function updateChartLegend() {
  const targetText = activeExpectedRange
    ? t("target", { v: formatNumber((activeExpectedRange.min + activeExpectedRange.max) / 2, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
    : t("no_target");
  chartLegendEl.innerHTML = `<span class="legend-item"><span class="legend-swatch"></span>${t("mer")}</span><span class="legend-item"><span class="legend-swatch target"></span>${targetText}</span>`;
}

function alignSymbolrate(width) {
  if (width < 0.022) return 0;
  if (width < 0.060) return 0.035;
  if (width < 0.086) return 0.066;
  if (width < 0.185) return 0.125;
  if (width < 0.277) return 0.25;
  if (width < 0.388) return 0.333;
  if (width < 0.700) return 0.5;
  if (width < 1.2) return 1.0;
  if (width < 1.6) return 1.5;
  if (width < 2.2) return 2.0;
  return Math.round(width * 5) / 5.0;
}

function countBatcActiveSignals(fftData) {
  const signalThreshold = 16000;
  const noiseLevel = 11000;
  let inSignal = false;
  let startSignal = 0;
  let count = 0;

  for (let i = 2; i < fftData.length; i++) {
    const avg3 = (fftData[i] + fftData[i - 1] + fftData[i - 2]) / 3.0;
    if (!inSignal && avg3 > signalThreshold) {
      inSignal = true;
      startSignal = i;
      continue;
    }
    if (inSignal && avg3 < signalThreshold) {
      inSignal = false;
      let endSignal = i;
      if (endSignal <= startSignal) continue;

      let acc = 0;
      let accCount = 0;
      const l = Math.floor(startSignal + 0.3 * (endSignal - startSignal));
      const r = Math.floor(startSignal + 0.7 * (endSignal - startSignal));
      for (let j = l; j < r; j++) {
        acc += fftData[j];
        accCount++;
      }
      const strength = accCount ? acc / accCount : noiseLevel;

      let s = startSignal;
      while (s < endSignal && (fftData[s] - noiseLevel) < 0.75 * (strength - noiseLevel)) s++;
      let e = endSignal;
      while (e > s && (fftData[e] - noiseLevel) < 0.75 * (strength - noiseLevel)) e--;
      if (e <= s) continue;

      const mid = s + (e - s) / 2.0;
      const bw = alignSymbolrate((e - s) * (9.0 / fftData.length));
      const signalFreq = 490.5 + (((mid + 1) / fftData.length) * 9.0);

      if (signalFreq < 492.0) continue; // ignore beacon region
      if (bw >= 0.125) count++;
    }
  }
  return count;
}

function closeBatcMonitor() {
  if (batcReconnectTimer) {
    clearTimeout(batcReconnectTimer);
    batcReconnectTimer = null;
  }
  if (batcWs) {
    try { batcWs.close(); } catch {}
    batcWs = null;
  }
}

function openBatcMonitor() {
  if (batcWs && (batcWs.readyState === WebSocket.OPEN || batcWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  closeBatcMonitor();
  setWbStatusKey("wb_checking");
  batcWs = new WebSocket(BATC_WB_WS_URL, "fft");

  batcWs.onmessage = async (event) => {
    let buffer = null;
    if (event.data instanceof ArrayBuffer) {
      buffer = event.data;
    } else if (event.data instanceof Blob) {
      buffer = await event.data.arrayBuffer();
    }
    if (!buffer) return;

    const fftData = new Uint16Array(buffer);
    if (!fftData.length) return;
    drawWbFft(fftData);
    const active = countBatcActiveSignals(fftData);
    if (active === 0) {
      setWbStatusKey("wb_beacon", {}, "ok");
    } else {
      setWbStatusKey("wb_warning", { n: formatNumber(active, { maximumFractionDigits: 0 }) }, "warn");
    }
  };

  batcWs.onerror = () => setWbStatusKey("wb_unavailable");
  batcWs.onclose = () => {
    batcWs = null;
    setWbStatusKey("wb_reconnecting");
    batcReconnectTimer = setTimeout(openBatcMonitor, 3000);
  };
}

function addDebug(line) {
  if (!debugMode) return;
  const ts = new Date().toLocaleTimeString();
  debugLogEl.textContent = `[${ts}] ${line}\n` + debugLogEl.textContent;
  debugLogEl.textContent = debugLogEl.textContent.split("\n").slice(0, 120).join("\n");
}

function formatRxLabel(r) {
  const rxId = Number(r.rx);
  const state = r.state ? String(r.state) : "";
  const service = r.service_name ? String(r.service_name) : "";
  const provider = r.service_provider_name ? String(r.service_provider_name) : "";
  const mer = Number(r.mer);
  const merText = Number.isFinite(mer) ? `${formatNumber(mer, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dB` : "no MER";

  const parts = [`rx ${rxId}`];
  if (service) parts.push(service);
  if (!service && provider) parts.push(provider);
  if (state) parts.push(state);
  parts.push(merText);
  return parts.join(" | ");
}

function upsertRxOptions(rxArray) {
  rxArray.forEach((r) => {
    const rxNum = Number(r.rx);
    if (!Number.isFinite(rxNum) || rxNum <= 0) return;

    let opt = rxOptionMap.get(rxNum);
    if (!opt) {
      opt = document.createElement("option");
      opt.value = String(rxNum);
      rxOptionMap.set(rxNum, opt);
      rxSelectEl.appendChild(opt);
    }
    opt.textContent = formatRxLabel(r);
  });
}

function chooseRxWithMer(data) {
  upsertRxOptions(data.rx);

  const entries = data.rx
    .map((r) => ({ ...r, merNum: Number(r.mer), rxNum: Number(r.rx) }))
    .filter((r) => Number.isFinite(r.merNum) && r.rxNum > 0);

  if (!entries.length) return null;

  const selected = Number(rxSelectEl.value);
  if (selected >= 0) {
    const found = entries.find((r) => r.rxNum === selected);
    if (found) return { chosen: found, auto: false };
  }

  const best = entries.reduce((acc, r) => (acc.merNum >= r.merNum ? acc : r));
  return { chosen: best, auto: true };
}

function tryParseMessage(raw) {
  let data = raw;

  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      const n = Number(raw);
      if (Number.isFinite(n)) return { mer: n, source: "plain-number" };
      return { source: "text", raw };
    }
  }

  if (typeof data === "number") {
    return { mer: data, source: "number" };
  }

  if (!data || typeof data !== "object") {
    return { source: "unknown", raw };
  }

  if (Array.isArray(data.rx)) {
    const picked = chooseRxWithMer(data);
    if (picked) {
      const { chosen, auto } = picked;
      return {
        mer: chosen.merNum,
        source: auto ? `rx[${chosen.rx}].mer(auto)` : `rx[${chosen.rx}].mer`,
        rx: {
          frequency: chosen.frequency,
          demodState: chosen.state || chosen.scanstate,
          provider: chosen.service_provider_name,
          service: chosen.service_name
        }
      };
    }
  }

  if (data.packet && data.packet.rx && Number.isFinite(Number(data.packet.rx.mer))) {
    return {
      mer: Number(data.packet.rx.mer) / 10,
      source: "packet.rx.mer/10",
      rx: {
        frequency: data.packet.rx.frequency,
        demodState: data.packet.rx.demod_state,
        provider: data.packet.rx.provider,
        service: data.packet.rx.service
      }
    };
  }

  return { source: "no-mer-field", parsed: data };
}

function updateMer(mer, source, rx = null) {
  merPoints.push({ t: Date.now(), mer });
  if (merPoints.length > maxPoints) merPoints = merPoints.slice(-maxPoints);

  merValueEl.textContent = formatNumber(mer, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  merValueEl.dataset.lastSource = source;
  merValueEl._lastRx = rx;
  if (trendMerEl) trendMerEl.textContent = t("trend_mer", { mer: formatNumber(mer, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
  let trend = "stable";
  if (lastMer !== null) {
    if (mer > lastMer + 0.05) trend = "up";
    else if (mer < lastMer - 0.05) trend = "down";
  }
  lastMer = mer;

  merMetaEl.textContent = `${t("source")}: ${source} | ${t("trend_label")}: ${trend}`;
  merMetaEl.style.color = trend === "up" ? "#1f9f57" : trend === "down" ? "#bf2f4a" : "#334";

  if (rx) {
    const demodLabel = DEMOD_MAP[rx.demodState] ?? String(rx.demodState ?? "-");
    const freqVal = Number(rx.frequency);
    const freq = Number.isFinite(freqVal)
      ? `${formatNumber(freqVal, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} MHz`
      : (rx.frequency ? `${rx.frequency} MHz` : "-");
    const service = rx.service || "";
    rxMetaEl.textContent = `${t("demod")}: ${demodLabel} | ${t("freq")}: ${freq} ${service ? `| ${t("service")}: ${service}` : ""}`;
  }

  fitMerValueToWidth();
  drawChart();
  updateTone(mer);
}

function applyDishPreset() {
  const preset = DISH_MER_PRESETS[dishSizeSelectEl.value];
  if (!preset) {
    activeExpectedRange = null;
    const expectedLabel = ` | ${t("expected")}: `;
    merMetaEl.textContent = `${merMetaEl.textContent.split(expectedLabel)[0] || merMetaEl.textContent}`;
    updateChartLegend();
    drawChart();
    return;
  }

  activeExpectedRange = { min: preset.min, max: preset.max };
  toneMinMerEl.value = String(preset.min);
  toneMaxMerEl.value = String(preset.max);
  const current = merMetaEl.textContent || "";
  const base = current.split(` | ${t("expected")}: `)[0];
  merMetaEl.textContent = `${base} | ${t("expected")}: ${formatNumber(preset.min, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}-${formatNumber(preset.max, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dB`;
  updateChartLegend();
  drawChart();
}

function drawChart() {
  if (!canvasReady) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  if (!merPoints.length) {
    ctx.fillStyle = "#678";
    ctx.font = "20px Trebuchet MS";
    ctx.fillText(t("waiting"), 20, h / 2);
    return;
  }

  const values = merPoints.map((p) => p.mer);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }

  const pad = 28;
  const xFor = (i) => pad + (i / Math.max(1, merPoints.length - 1)) * (w - pad * 2);
  const yFor = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);

  ctx.strokeStyle = "#d4e3ea";
  for (let i = 0; i < 5; i++) {
    const y = pad + (i / 4) * (h - pad * 2);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#0e8f82";
  ctx.lineWidth = 3;
  ctx.beginPath();
  merPoints.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.mer);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  if (activeExpectedRange) {
    const target = (activeExpectedRange.min + activeExpectedRange.max) / 2;
    const clampedTarget = Math.max(min, Math.min(max, target));
    const y = yFor(clampedTarget);
    ctx.strokeStyle = "#a86f00";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

}

function resizeChartCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.max(1, Math.floor(canvas.clientWidth));
  const displayHeight = Math.max(1, Math.floor(canvas.clientHeight));
  const targetWidth = Math.floor(displayWidth * dpr);
  const targetHeight = Math.floor(displayHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasReady = true;
  scheduleMerRefitBurst();
  drawChart();
}

function ensureTone() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 300;
    gainNode.gain.value = 0;
    oscillator.connect(gainNode).connect(audioCtx.destination);
    oscillator.start();
  }
}

function updateTone(mer) {
  if (!toneEnabledEl.checked) {
    if (gainNode && audioCtx) gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03);
    return;
  }

  ensureTone();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const minMer = Number(toneMinMerEl.value);
  const maxMer = Number(toneMaxMerEl.value);
  const span = Math.max(0.1, maxMer - minMer);
  const normalized = Math.max(0, Math.min(1, (mer - minMer) / span));

  const freq = 220 + normalized * 980;
  oscillator.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
  gainNode.gain.setTargetAtTime(0.04, audioCtx.currentTime, 0.03);
}

function stopTone() {
  if (gainNode && audioCtx) {
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
  }
}

function connect() {
  const ip = wsIpInput.value.trim();
  const port = wsPortInput.value.trim() || "8080";
  if (!ip) return;
  const url = `ws://${ip}:${port}`;

  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  setStatusKey("status_connecting");
  ws = new WebSocket(url, "monitor");

  ws.onopen = () => {
    setStatusKey("status_connected", true);
    setUiConnected(true);
    saveLastConnection(ip, port);
    addDebug(`connected to ${url} (protocol: monitor)`);
  };

  ws.onclose = () => {
    setStatusKey("status_disconnected");
    setUiConnected(false);
    stopTone();
    addDebug("socket closed");
  };

  ws.onerror = () => {
    setStatusKey("status_error");
    setUiConnected(false);
    stopTone();
    addDebug("socket error");
  };

  ws.onmessage = async (event) => {
    let raw = event.data;
    if (raw instanceof Blob) raw = await raw.text();
    else if (raw instanceof ArrayBuffer) raw = new TextDecoder().decode(raw);

    const parsed = tryParseMessage(raw);
    if (Number.isFinite(parsed.mer)) {
      updateMer(parsed.mer, parsed.source, parsed.rx || null);
    } else {
      addDebug(`unparsed: ${typeof raw === "string" ? raw : JSON.stringify(raw)}`);
    }
  };
}

connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", () => ws && ws.close());
clearChartBtn.addEventListener("click", () => {
  merPoints = [];
  drawChart();
});

dishSizeSelectEl.addEventListener("change", applyDishPreset);

setStatusKey("status_disconnected");
setUiConnected(false);
setWbStatusKey("wb_checking");
loadLastConnection();
disableIOSZoomGestures();
updateDynamicViewportHeightVar();
scheduleMerRefitBurst();
resizeChartCanvas();
applyDishPreset();
updateChartLegend();
const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
const browserLang = (navigator.language || "en").slice(0, 2).toLowerCase();
const initialLang = I18N[savedLang] ? savedLang : (I18N[browserLang] ? browserLang : "en");
if (langSelectEl) {
  langSelectEl.value = initialLang;
  langSelectEl.addEventListener("change", () => applyLanguage(langSelectEl.value));
}
applyLanguage(initialLang);
window.addEventListener("resize", resizeChartCanvas);
window.addEventListener("resize", updateDynamicViewportHeightVar);
window.addEventListener("orientationchange", scheduleMerRefitBurst);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateDynamicViewportHeightVar);
  window.visualViewport.addEventListener("resize", scheduleMerRefitBurst);
}
if (!debugMode && debugPanelEl) {
  debugPanelEl.style.display = "none";
}

wbStatusEl.title = t("wb_checking");
wbStatusEl.style.cursor = "pointer";
wbStatusEl.addEventListener("click", () => {
  wbFftWrapEl.toggleAttribute("hidden");
  if (!wbFftWrapEl.hasAttribute("hidden")) {
    resizeWbFftCanvas();
  }
});
window.addEventListener("resize", () => {
  if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
});
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    exitPseudoFullscreen();
    globalExitFsBtn.hidden = false;
  } else if (!pseudoFullscreenEl) {
    globalExitFsBtn.hidden = true;
  }
  resizeChartCanvas();
  scheduleMerRefitBurst();
  if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
});

function bindFullscreenButton(buttonEl, openFn) {
  let suppressClickUntil = 0;
  let lastTriggerAt = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let movedDuringTouch = false;
  const moveThresholdPx = 10;
  const trigger = () => {
    const now = Date.now();
    if (now - lastTriggerAt < 350) return;
    lastTriggerAt = now;
    suppressClickUntil = now + 700;
    openFn();
  };

  buttonEl.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    if (movedDuringTouch) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    trigger();
  });

  buttonEl.addEventListener("touchstart", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    movedDuringTouch = false;
  }, { passive: true });

  buttonEl.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    if (
      Math.abs(t.clientX - touchStartX) > moveThresholdPx ||
      Math.abs(t.clientY - touchStartY) > moveThresholdPx
    ) {
      movedDuringTouch = true;
    }
  }, { passive: true });

  buttonEl.addEventListener("touchend", (e) => {
    if (movedDuringTouch) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    trigger();
  }, { passive: false });

  buttonEl.addEventListener("click", (e) => {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      return;
    }
    openFn();
  });
}

bindFullscreenButton(merFullscreenBtn, () => toggleFullscreenFor(document.querySelector(".mer-panel")));
bindFullscreenButton(trendFullscreenBtn, () => toggleFullscreenFor(document.querySelector(".chart-panel")));
bindFullscreenButton(wbFullscreenBtn, () => {
  if (wbFftWrapEl.hasAttribute("hidden")) wbFftWrapEl.removeAttribute("hidden");
  resizeWbFftCanvas();
  toggleFullscreenFor(wbFftWrapEl);
});
globalExitFsBtn.addEventListener("click", () => {
  exitAnyFullscreen();
});
openBatcMonitor();
