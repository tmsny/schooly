(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {});
  const n = new Date();
  const C = (HM.Cal = { y: n.getFullYear(), m: n.getMonth(), sel: U.today(), tab: 'month' });
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const byDay = (iso) => HM.state.homework.filter((h) => h.due === iso).sort((a, b) => a.done - b.done || a.title.localeCompare(b.title, 'de'));
  const tasks = (l, empty) => (l.length ? '<div class="list">' + l.map(HM.Homework.item).join('') + '</div>' : '<p class="mute small">' + empty + '</p>');

  function month() {
    const ws = HM.state.settings.weekStart, first = new Date(C.y, C.m, 1), today = U.today();
    const offset = (first.getDay() - ws + 7) % 7, start = new Date(C.y, C.m, 1 - offset);
    let cells = DOW.map((_, i) => '<div class="dow">' + DOW[(i + ws) % 7] + '</div>').join('');
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), iso = U.iso(d), l = byDay(iso);
      if (i >= 35 && d.getMonth() !== C.m) break;
      const chips = l.slice(0, 2).map((h) => '<span class="c' + (HM.Homework.status(h) === 'overdue' ? ' od' : '') + '">' + E(h.title) + '</span>').join('');
      cells += '<button class="day' + (d.getMonth() !== C.m ? ' out' : '') + (iso === today ? ' today' : '') + '" data-action="cal-day" data-date="' + iso + '" aria-pressed="' + (iso === C.sel) + '" aria-label="' + E(U.fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })) + ', ' + l.length + ' Aufgaben"><b>' + d.getDate() + '</b>' + chips + (l.length ? '<span class="n">' + l.length + '</span>' : '') + '</button>';
    }
    const l = byDay(C.sel);
    return '<div class="sec"><div class="acts"><button class="icon-btn" data-action="cal-prev" aria-label="Voriger Monat">' + U.icon('left') + '</button><h2 style="min-width:140px;text-align:center" aria-live="polite">' + MONTHS[C.m] + ' ' + C.y + '</h2><button class="icon-btn" data-action="cal-next" aria-label="Nächster Monat">' + U.icon('right') + '</button></div><button class="btn ghost sm" data-action="cal-today">Heute</button></div>' +
      '<div class="cal">' + cells + '</div>' +
      '<section class="card" style="margin-top:20px"><div class="sec"><h2>' + E(U.fmt(C.sel, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h2><button class="btn sm" data-action="hw-new" data-due="' + C.sel + '">' + U.icon('plus') + 'Aufgabe</button></div>' + tasks(l, 'Keine Aufgaben an diesem Tag.') + '</section>';
  }
  function week() {
    let out = '';
    for (let i = 0; i < 7; i++) {
      const iso = U.addDays(U.today(), i);
      out += '<section class="card"><div class="sec"><h2>' + (i === 0 ? 'Heute' : i === 1 ? 'Morgen' : E(U.fmt(iso, { weekday: 'long' }))) + '</h2><span class="small mute">' + U.fmt(iso, { day: '2-digit', month: '2-digit' }) + '</span></div>' + tasks(byDay(iso), 'Nichts fällig.') + '</section>';
    }
    return '<div class="stack">' + out + '</div>';
  }
  C.render = function () {
    return '<div class="head"><h1>Kalender</h1><div class="seg" role="group" aria-label="Ansicht"><button data-action="cal-tab" data-tab="month" aria-pressed="' + (C.tab === 'month') + '" style="gap:6px;padding:7px 12px">Monat</button><button data-action="cal-tab" data-tab="week" aria-pressed="' + (C.tab === 'week') + '" style="padding:7px 12px">Nächste 7 Tage</button></div></div>' + (C.tab === 'month' ? month() : week());
  };
  A['cal-tab'] = (el) => { C.tab = el.dataset.tab; HM.render(); };
  A['cal-day'] = (el) => { C.sel = el.dataset.date; const d = U.parse(C.sel); C.y = d.getFullYear(); C.m = d.getMonth(); HM.render(); const b = document.querySelector('[data-date="' + C.sel + '"]'); if (b) b.focus(); };
  A['cal-prev'] = () => { C.m--; if (C.m < 0) { C.m = 11; C.y--; } HM.render(); };
  A['cal-next'] = () => { C.m++; if (C.m > 11) { C.m = 0; C.y++; } HM.render(); };
  A['cal-today'] = () => { const t = new Date(); C.y = t.getFullYear(); C.m = t.getMonth(); C.sel = U.today(); HM.render(); };
})();
