/* ═══════════════════════════════════════════════════════════
   site.js — السلوك المشترك بين صفحات الموقع
   الوضع الليلي · ألوان الشرائح · تمرير الاستهلاك بين الأداتين
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var DK_KEY = 'irq_dk';
  var el = document.documentElement;

  /* ── الوضع الليلي ──
     التخزين: '1' ليلي · '0' نهاري · غير موجود = اتبع إعداد الجهاز.
     التطبيق الأولي يحدث في <head> لتفادي وميض الصفحة. */
  function isDark() { return el.classList.contains('dk'); }

  function syncDkButtons() {
    var dark = isDark();
    var btns = document.querySelectorAll('[data-dk-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = dark ? '☀️' : '🌙';
      btns[i].setAttribute('aria-pressed', dark ? 'true' : 'false');
      btns[i].setAttribute('aria-label', dark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0E0F1F' : '#F3F5FE');
  }

  function setDark(on) {
    el.classList.toggle('dk', !!on);
    try { localStorage.setItem(DK_KEY, on ? '1' : '0'); } catch (e) {}
    syncDkButtons();
    applyTierColors();
  }

  function toggleDk() { setDark(!isDark()); }

  /* ── ألوان الشرائح تأتي من tariff.js وحده ──
     تُحقن كمتغيّرات CSS (‎--t1…‎) فتستعملها صفحات الموقع في العرض. */
  function applyTierColors() {
    if (!root.Tariff) return;
    var dark = isDark();
    root.Tariff.TIERS.forEach(function (t, i) {
      el.style.setProperty('--t' + (i + 1), (dark && t.colorDark) ? t.colorDark : t.color);
    });
  }

  /* ── تمرير الاستهلاك بين الأداتين ──
     صفحة الفاتورة ترسل ‎/solar?kwh=…‎ وصفحة الشمسي ترسل ‎/bill?u=…‎ */
  function param(name) {
    var v = parseInt(new URLSearchParams(location.search).get(name), 10);
    return (isFinite(v) && v > 0) ? v : null;
  }
  function toSolar(monthlyKwh) {
    return '/solar' + (monthlyKwh > 0 ? '?kwh=' + Math.round(monthlyKwh) : '');
  }
  function toBill(monthlyKwh) {
    return '/bill' + (monthlyKwh > 0 ? '?u=' + Math.round(monthlyKwh) : '');
  }

  /* ── الصفحة الحالية في شريط التنقّل ──
     الشريط نفسه مكتوب حرفياً في الصفحات الثلاث حتى يظهر فوراً بلا انتظار،
     وهذه الدالة وحدها تقرّر أي تبويب هو النشط. */
  function markCurrentTab() {
    var path = location.pathname.replace(/\/index\.html$|\.html$/, '') || '/';
    var tabs = document.querySelectorAll('.site-nav .nav-tab');
    for (var i = 0; i < tabs.length; i++) {
      var href = tabs[i].getAttribute('href');
      if (href === path) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
  }

  /* ── أيقونة «معلومات إضافية» ──
     نافذة واحدة مشتركة تنتقل إلى الأيقونة المضغوطة. بالنقر لا بالمرور،
     وتُغلق بالنقر خارجها أو بالضغط عليها ثانيةً أو بمفتاح Esc. */
  var tipBox = null, tipBtn = null;

  function tipEnsure() {
    if (tipBox) return tipBox;
    tipBox = document.createElement('div');
    tipBox.className = 'infop';
    tipBox.id = 'infop';
    tipBox.setAttribute('role', 'tooltip');
    document.body.appendChild(tipBox);
    return tipBox;
  }

  function tipClose() {
    if (!tipBtn) return;
    tipBtn.setAttribute('aria-expanded', 'false');
    tipBtn.removeAttribute('aria-describedby');
    tipBtn = null;
    if (tipBox) tipBox.classList.remove('on');
  }

  function tipPlace(btn) {
    var r = btn.getBoundingClientRect();
    tipBox.style.left = '0px';
    tipBox.style.top = '0px';
    var w = tipBox.offsetWidth, h = tipBox.offsetHeight;
    var left = r.left + r.width / 2 - w / 2;
    left = Math.max(10, Math.min(left, document.documentElement.clientWidth - w - 10));
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    tipBox.style.left = (left + window.pageXOffset) + 'px';
    tipBox.style.top = (top + window.pageYOffset) + 'px';
  }

  function tipOpen(btn) {
    var box = tipEnsure();
    box.textContent = btn.getAttribute('data-tip') || '';
    box.classList.add('on');
    tipBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-describedby', box.id);
    tipPlace(btn);
  }

  function initInfoTips() {
    /* مرحلة الالتقاط: البطاقات حولها onclick خاص بها، فنمنع وصول النقرة إليه */
    document.addEventListener('click', function (e) {
      var t = e.target, btn = null;
      if (t && t.closest) btn = t.closest('[data-tip]');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (tipBtn === btn) tipClose(); else tipOpen(btn);
        return;
      }
      if (tipBtn && (!tipBox || !tipBox.contains(t))) tipClose();
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) tipClose();
    });
    window.addEventListener('resize', tipClose);
    window.addEventListener('scroll', tipClose, true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncDkButtons();
    applyTierColors();
    markCurrentTab();
    initInfoTips();
  });

  /* لو لم يختر الزائر وضعاً صراحةً، تابع تغيّر إعداد الجهاز */
  if (root.matchMedia) {
    var mq = root.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function (e) {
      var stored = null;
      try { stored = localStorage.getItem(DK_KEY); } catch (err) {}
      if (stored === null) { el.classList.toggle('dk', e.matches); syncDkButtons(); applyTierColors(); }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  root.Site = {
    isDark: isDark,
    setDark: setDark,
    toggleDk: toggleDk,
    applyTierColors: applyTierColors,
    param: param,
    toSolar: toSolar,
    toBill: toBill,
    markCurrentTab: markCurrentTab,
    closeInfoTip: tipClose
  };
  /* اسم مختصر تستعمله أزرار onclick في الصفحتين */
  root.toggleDk = toggleDk;
})(window);
