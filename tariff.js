/* ═══════════════════════════════════════════════════════════════
   tariff.js — المصدر الوحيد لتعرفة الكهرباء المنزلية في العراق
   ───────────────────────────────────────────────────────────────
   ▸ هذا الملف هو المكان الوحيد الذي تُعدَّل فيه الأسعار.
     صفحة الفاتورة (/bill) وصفحة الطاقة الشمسية (/solar) تقرآن منه معاً،
     ولا توجد أي نسخة ثانية من الشرائح في أي ملف آخر.

   ▸ عند تغيير وزارة الكهرباء للتعرفة: عدّل مصفوفة TIERS أدناه فقط،
     ثم حدّث UPDATED و SOURCE. كل الجداول والأشرطة والأمثلة في
     الصفحتين تُبنى تلقائياً من هذه المصفوفة.

   ▸ upTo = الحد الأعلى التراكمي للشريحة بالكيلوواط/ساعة في الشهر.
     rate  = سعر الوحدة داخل الشريحة بالدينار.
     الاحتساب تصاعدي تراكمي: كل شريحة تُحسب بسعرها الخاص.
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var TIERS = [
    { upTo: 1500,     rate: 10,  name: 'الشريحة الأولى',  nameEn: 'Tier 1', short: 'الشريحة ١', color: '#1E8A5A', colorDark: '#43C48D', id: 't1' },
    { upTo: 3000,     rate: 35,  name: 'الشريحة الثانية', nameEn: 'Tier 2', short: 'الشريحة ٢', color: '#1A7AAE', colorDark: '#5AAEE0', id: 't2' },
    { upTo: 4000,     rate: 80,  name: 'الشريحة الثالثة', nameEn: 'Tier 3', short: 'الشريحة ٣', color: '#C06820', colorDark: '#E8974A', id: 't3' },
    { upTo: Infinity, rate: 120, name: 'الشريحة الرابعة', nameEn: 'Tier 4', short: 'الشريحة ٤', color: '#B03030', colorDark: '#E85F5F', id: 't4' }
  ];

  /* بيانات تعريفية تظهر في تذييل صفحة الفاتورة */
  var META = {
    updated: '2018',
    category: 'الصنف المنزلي',
    source: 'تعرفة الصنف المنزلي المعتمدة من مجلس الوزراء (2018) والمعمول بها حالياً',
    currency: 'دينار',
    currencyShort: 'د'
  };

  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };

  /* الحد الأدنى لكل شريحة (تراكمي) */
  function floorOf(i) { return i === 0 ? 0 : TIERS[i - 1].upTo; }

  /* سعة الشريحة بالوحدات */
  function capacityOf(i) {
    return TIERS[i].upTo === Infinity ? Infinity : TIERS[i].upTo - floorOf(i);
  }

  /* حدود الانتقال بين الشرائح: [1500, 3000, 4000] */
  function bounds() {
    return TIERS.slice(0, -1).map(function (t) { return t.upTo; });
  }

  /* نص المدى: "1,501 – 3,000" أو "4,001 فما فوق" */
  function rangeLabel(i, opts) {
    opts = opts || {};
    var lo = floorOf(i) + 1, hi = TIERS[i].upTo;
    var plus = opts.en ? '+' : 'فما فوق';
    if (hi === Infinity) return opts.en ? fmt(lo) + '+' : fmt(lo) + ' ' + plus;
    return fmt(lo) + (opts.en ? '–' : ' – ') + fmt(hi);
  }

  /* ── الحساب الأساسي ──
     يستقبل عدد الوحدات في الشهر، ويعيد:
       { units, total, rows: [{ ...tier, index, used, cost }] }
     rows تحتوي فقط الشرائح المستهلكة فعلياً. */
  function bill(units) {
    var u = Number(units);
    if (!isFinite(u) || u <= 0) return { units: 0, total: 0, rows: [] };

    var remaining = u, total = 0, rows = [];
    for (var i = 0; i < TIERS.length; i++) {
      if (remaining <= 0) break;
      var used = Math.min(remaining, capacityOf(i));
      var cost = used * TIERS[i].rate;
      total += cost;
      remaining -= used;
      rows.push(Object.assign({}, TIERS[i], { index: i, used: used, cost: cost }));
    }
    return { units: u, total: total, rows: rows };
  }

  /* المجموع فقط — للاستخدام السريع */
  function total(units) { return bill(units).total; }

  /* الفاتورة الشهرية من استهلاك سنوي (تستعملها حاسبة الطاقة الشمسية) */
  function monthlyFromAnnual(annualKwh) {
    return Math.round(total(Number(annualKwh) / 12));
  }

  /* الشريحة التي يقع فيها الاستهلاك */
  function tierOf(units) {
    for (var i = 0; i < TIERS.length; i++) if (units <= TIERS[i].upTo) return TIERS[i];
    return TIERS[TIERS.length - 1];
  }

  /* المسافة المتبقية قبل الشريحة التالية — يعيد null عند أعلى شريحة */
  function nextBoundary(units) {
    var b = bounds();
    for (var i = 0; i < b.length; i++) {
      if (units < b[i]) return { at: b[i], gap: b[i] - units, nextRate: TIERS[i + 1].rate };
    }
    return null;
  }

  /* معدل سعر الوحدة الفعلي */
  function averageRate(units) {
    var u = Number(units);
    return u > 0 ? total(u) / u : 0;
  }

  /* ── مولّدات عرض مشتركة ──
     تبني الجداول من TIERS مباشرة حتى لا يبقى أي سعر مكتوب يدوياً. */

  /* سطر مختصر: "10د (1–1,500) · 35د (1,501–3,000) · …" */
  function inlineSummary() {
    return TIERS.map(function (t, i) {
      return t.rate + 'د (' + rangeLabel(i, { en: true }) + ')';
    }).join(' · ');
  }

  /* جدول التعرفة الثابت (صفحة الفاتورة) */
  function tariffTableHTML() {
    var head = '<thead><tr><th>الشريحة</th><th>عدد الوحدات</th><th>السعر / وحدة</th></tr></thead>';
    var body = TIERS.map(function (t, i) {
      return '<tr><td>' + t.name.replace('الشريحة ', '') + '</td><td>' +
             rangeLabel(i) + '</td><td>' + t.rate + ' د</td></tr>';
    }).join('');
    return head + '<tbody>' + body + '</tbody>';
  }

  /* شريط الشرائح الأربع (صفحة الفاتورة) */
  function tierStripHTML() {
    return TIERS.map(function (t, i) {
      return '<div class="tier-item ' + t.id + '" id="' + t.id + '">' +
             '<span class="tl">' + t.short + '</span>' +
             '<span class="tp">' + t.rate + ' د</span>' +
             '<span class="tr">' + rangeLabel(i) + '</span></div>';
    }).join('');
  }

  /* مثال محسوب تلقائياً عند استهلاك معيّن */
  function exampleHTML(units) {
    var r = bill(units);
    var lines = r.rows.map(function (row) {
      return fmt(row.used) + ' × ' + row.rate + ' = ' + fmt(row.cost) + ' د';
    }).join('<br>');
    return '<b>مثال — استهلاك ' + fmt(units) + ' وحدة:</b><br>' + lines +
           '<br><b>الإجمالي = ' + fmt(r.total) + ' دينار</b>';
  }

  /* جدول تفصيلي لاستهلاك سنوي (صفحة الطاقة الشمسية).
     opts.format — دالة تنسيق أرقام اختيارية (صفحة الشمسي تستعمل أرقاماً عربية). */
  function annualTableHTML(annualKwh, opts) {
    var money = (opts && opts.format) || fmt;
    var mo = Number(annualKwh) / 12;
    var r = bill(mo);
    var html = '<tr><th>الشريحة</th><th>kWh/شهر</th><th>دينار/kWh</th><th>التكلفة</th></tr>';
    r.rows.forEach(function (row) {
      var isLast = row.index === r.rows.length - 1;
      html += '<tr' + (isLast ? ' class="thl"' : '') + '><td>' + (row.index + 1) + '</td><td>' +
              rangeLabel(row.index, { en: true }) +
              ' (' + fmt(row.used) + ' مُستخدم)' + '</td><td>' + row.rate + '</td><td>' +
              money(Math.round(row.cost)) + '</td></tr>';
    });
    return html;
  }

  root.Tariff = {
    TIERS: TIERS,
    META: META,
    fmt: fmt,
    bill: bill,
    total: total,
    monthlyFromAnnual: monthlyFromAnnual,
    tierOf: tierOf,
    nextBoundary: nextBoundary,
    averageRate: averageRate,
    bounds: bounds,
    floorOf: floorOf,
    capacityOf: capacityOf,
    rangeLabel: rangeLabel,
    inlineSummary: inlineSummary,
    tariffTableHTML: tariffTableHTML,
    tierStripHTML: tierStripHTML,
    exampleHTML: exampleHTML,
    annualTableHTML: annualTableHTML
  };
})(window);
