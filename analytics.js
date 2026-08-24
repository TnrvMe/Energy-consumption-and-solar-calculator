/* ═══════════════════════════════════════════════════════════════
   analytics.js — قياس استخدام مجهول بالكامل
   ───────────────────────────────────────────────────────────────
   ▸ ما يُرسَل: أحداث الاستخدام فقط، وبيانات أدخلها الزائر بنفسه في
     الحاسبة (المدينة، الاستهلاك، الأجهزة، حجم المنظومة، مصادر الطاقة).

   ▸ ما لا يُرسَل أبداً: لا اسم ولا بريد ولا رقم هاتف، ولا إحداثيات
     GPS، ولا بصمة جهاز، ولا عنوان IP، ولا أي سكربت طرف ثالث.

   ▸ معرّف الجلسة رقم عشوائي بحت يُولَّد من crypto، ويُخزَّن في
     sessionStorage فقط — يزول بإغلاق التبويب، ولا يُشتق من أي شيء
     يخص الزائر أو جهازه. الغرض الوحيد منه ربط أحداث الزيارة الواحدة.

   ▸ لا يعطّل شيئاً: كل شيء داخل try/catch، والإرسال عبر sendBeacon
     فلا يؤخّر تحميل الصفحة ولا الانتقال منها. أي فشل يُتجاهل بصمت.
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbx4eM5hdD4vlVX7UOyoE8fIu2dpBL0W8Gm511eWMU7D5T8e0bNVv1ZUCP4igyrOQ0B53g/exec';
  /* مفتاح مشترك يرفض به المنفذ الطلبات العشوائية الآلية.
     ظاهر في المصدر كالرابط تماماً — غرضه تصفية الضجيج لا الحماية. */
  var SECRET   = '_87G5MUuDTh1MFA2bPDJEroMJXJ9S6EU';
  var SID_KEY  = 'irq_sid';

  /* ── اسم الصفحة من المسار ── */
  function pageName() {
    var p = '';
    try { p = location.pathname.replace(/\/index\.html$|\.html$/, ''); } catch (e) {}
    if (p.indexOf('/bill') === 0)  return 'bill';
    if (p.indexOf('/solar') === 0) return 'solar';
    return 'home';
  }

  /* ── معرّف عشوائي بحت — لا يعتمد على وقت أو جهاز أو شبكة ── */
  function randomId() {
    try {
      if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
      if (root.crypto && root.crypto.getRandomValues) {
        var a = new Uint8Array(16);
        root.crypto.getRandomValues(a);
        return Array.prototype.map.call(a, function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      }
    } catch (e) {}
    return 'r' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  /* ── الجلسة: sessionStorage فقط، فتنتهي بانتهاء التبويب ── */
  var memId = null;
  function sessionId() {
    try {
      var v = sessionStorage.getItem(SID_KEY);
      if (!v) { v = randomId(); sessionStorage.setItem(SID_KEY, v); }
      return v;
    } catch (e) {
      /* التخزين محجوب — نبقي المعرّف في الذاكرة وحدها */
      if (!memId) memId = randomId();
      return memId;
    }
  }

  /* ── الإرسال: sendBeacon أولاً، ثم fetch مهمل النتيجة ──
     النوع text/plain يجعله طلباً بسيطاً بلا preflight،
     وApps Script يقرأ الجسم من e.postData.contents على أي حال. */
  function send(body) {
    var json;
    try { json = JSON.stringify(body); } catch (e) { return; }

    try {
      if (root.navigator && navigator.sendBeacon) {
        var blob = new Blob([json], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
    } catch (e) {}

    try {
      root.fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true,
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: json
      })['catch'](function () {});
    } catch (e) {}
  }

  /* ── الواجهة الأساسية ── */
  function track(event, data) {
    try {
      var body = { secret: SECRET, session_id: sessionId(), page: pageName(), event: String(event) };
      if (data) {
        for (var k in data) {
          if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
          var v = data[k];
          if (v === undefined || v === null || v === '') continue;
          body[k] = v;
        }
      }
      send(body);
    } catch (e) {}
  }

  /* ── تجميع الأحداث المتكرّرة ──
     حاسبة الفاتورة تُعيد الحساب مع كل ضغطة مفتاح، فلا نرسل صفاً لكل رقم:
     نرسل آخر قيمة فقط بعد توقّف الكتابة. */
  var timers = {}, pending = {};
  function trackDebounced(key, ms, event, data) {
    try {
      pending[key] = { e: event, d: data };
      clearTimeout(timers[key]);
      timers[key] = setTimeout(function () { flushKey(key); }, ms);
    } catch (e) {}
  }
  function flushKey(key) {
    try {
      var p = pending[key];
      if (!p) return;
      delete pending[key];
      clearTimeout(timers[key]);
      track(p.e, p.d);
    } catch (e) {}
  }
  function flushAll() { try { for (var k in pending) flushKey(k); } catch (e) {} }

  /* ── مغادرة الصفحة ──
     visibilitychange/pagehide (لا beforeunload) — تُنفَّذ مرّة واحدة. */
  var hiddenDone = false, onHiddenFns = [];
  function onHidden(fn) { try { onHiddenFns.push(fn); } catch (e) {} }
  function fireHidden() {
    if (hiddenDone) return;
    hiddenDone = true;
    for (var i = 0; i < onHiddenFns.length; i++) {
      try { onHiddenFns[i](); } catch (e) {}
    }
    flushAll();
  }
  try {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') fireHidden();
    });
    root.addEventListener('pagehide', fireHidden);
  } catch (e) {}

  root.Analytics = {
    track: track,
    trackDebounced: trackDebounced,
    onHidden: onHidden,
    sessionId: sessionId,
    page: pageName
  };
  /* اسم مختصر تستعمله الصفحات: window.track&&track(...) */
  root.track = track;

  /* ── حدث الدخول ── */
  track('page_view');
})(window);
