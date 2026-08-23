/* ═══════════════════════════════════════════════════════════
   site.js — السلوك المشترك بين صفحتَي الموقع
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
    if (meta) meta.setAttribute('content', dark ? '#14110B' : '#F4F1EC');
  }

  function setDark(on) {
    el.classList.toggle('dk', !!on);
    try { localStorage.setItem(DK_KEY, on ? '1' : '0'); } catch (e) {}
    syncDkButtons();
    applyTierColors();
  }

  function toggleDk() { setDark(!isDark()); }

  /* ── ألوان الشرائح تأتي من tariff.js وحده ──
     تُحقن كمتغيّرات CSS (‎--t1…‎) فتستعملها الصفحتان في العرض. */
  function applyTierColors() {
    if (!root.Tariff) return;
    var dark = isDark();
    root.Tariff.TIERS.forEach(function (t, i) {
      el.style.setProperty('--t' + (i + 1), (dark && t.colorDark) ? t.colorDark : t.color);
    });
  }

  /* ── تمرير الاستهلاك بين الأداتين ──
     صفحة الفاتورة ترسل ‎/solar?kwh=…‎ وصفحة الشمسي ترسل ‎/?u=…‎ */
  function param(name) {
    var v = parseInt(new URLSearchParams(location.search).get(name), 10);
    return (isFinite(v) && v > 0) ? v : null;
  }
  function toSolar(monthlyKwh) {
    return '/solar' + (monthlyKwh > 0 ? '?kwh=' + Math.round(monthlyKwh) : '');
  }
  function toBill(monthlyKwh) {
    return '/' + (monthlyKwh > 0 ? '?u=' + Math.round(monthlyKwh) : '');
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncDkButtons();
    applyTierColors();
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
    toBill: toBill
  };
  /* اسم مختصر تستعمله أزرار onclick في الصفحتين */
  root.toggleDk = toggleDk;
})(window);
