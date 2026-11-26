/* Charts and compare tray for Token Radar 2.
   Drawn only from window.RADAR, the data the page already ships.
   No network, no extra source: the top-10 chart and the category
   breakdown recompute from the same 226 board rows, and the compare
   tray reads each protocol's farm plan from the board file beside
   the page when it is there. Runs after app.js renders the board,
   and re-attaches whenever the board re-renders (sort, filter, tab). */
(function () {
  "use strict";

  var MAX_COMPARE = 3;
  var TOP_N = 10;
  var CAT_N = 9; // top categories shown, the rest fold into "Other"
  var selected = []; // slugs, in the order picked
  var farmBySlug = null; // slug -> farm_steps, once the board file loads
  var farmTried = false;
  var attachTimer = 0;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(v) {
    if (v == null || !isFinite(v)) return "—";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return "$" + Math.round(v / 1e3) + "K";
    return "$" + Math.round(v);
  }

  function trimNum(v, digits) {
    var s = v.toFixed(digits);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }

  function pct(v) {
    if (v == null || !isFinite(v)) return "n/a";
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  }

  function age(days) {
    if (days == null || !isFinite(days)) return "—";
    if (days >= 365) return trimNum(days / 365, 1) + "y";
    return Math.round(days) + "d";
  }

  function mult(v) {
    if (v == null || !isFinite(v)) return "—";
    return String(Math.round(v * 10000) / 10000);
  }

  function shortName(name, max) {
    if (name.length <= max) return name;
    return name.slice(0, max - 1) + "…";
  }

  function rows() {
    var r = window.RADAR;
    if (!r || !Array.isArray(r.rows)) return [];
    return r.rows.slice().sort(function (a, b) { return a.rank - b.rank; });
  }

  function bySlug() {
    var map = {};
    rows().forEach(function (r) { map[r.slug] = r; });
    return map;
  }

  /* ---------- Top-10 chart: one SVG, bars sized by implied value ---------- */
  function top10Svg(top) {
    var max = top.length ? top[0].implied_value_usd : 1;
    var rowH = 31;
    var h = top.length * rowH + 4;
    var out = [];
    out.push('<svg class="cx-top10" viewBox="0 0 620 ' + h + '" role="img" aria-label="Top 10 protocols by implied value">');
    top.forEach(function (r, i) {
      var y = i * rowH + 4;
      var w = Math.max(3, Math.round(300 * (r.implied_value_usd / max)));
      var label = r.rank + ". ";
      out.push('<g><title>' + esc(r.name) + " — " + esc(money(r.implied_value_usd)) + "</title>");
      out.push('<text x="2" y="' + (y + 20) + '" font-size="13"><tspan class="cx-r">' + esc(label) + "</tspan>" + esc(shortName(r.name, 24)) + "</text>");
      out.push('<rect x="205" y="' + (y + 9) + '" width="300" height="10" rx="5" fill="#e7e5e0"/>');
      out.push('<rect x="205" y="' + (y + 9) + '" width="' + w + '" height="10" rx="5" fill="#166534"/>');
      out.push('<text class="cx-v" x="512" y="' + (y + 20) + '" font-size="13">' + esc(money(r.implied_value_usd)) + "</text></g>");
    });
    out.push("</svg>");
    return out.join("");
  }

  /* ---------- Category breakdown: protocol count + summed implied value ---------- */
  function categoryRows(all) {
    var agg = {};
    all.forEach(function (r) {
      var c = r.category || "Uncategorised";
      if (!agg[c]) agg[c] = { name: c, count: 0, sum: 0 };
      agg[c].count += 1;
      agg[c].sum += r.implied_value_usd || 0;
    });
    var list = Object.keys(agg).map(function (k) { return agg[k]; });
    list.sort(function (a, b) { return b.sum - a.sum; });
    var head = list.slice(0, CAT_N);
    var rest = list.slice(CAT_N);
    if (rest.length) {
      var other = { name: "Other", count: 0, sum: 0, cats: rest.length };
      rest.forEach(function (c) { other.count += c.count; other.sum += c.sum; });
      head.push(other);
    }
    var max = head.length ? head[0].sum : 1;
    return head.map(function (c) {
      var w = Math.max(2, Math.round(1000 * (c.sum / max)) / 10);
      var sub = c.count + (c.count === 1 ? " protocol" : " protocols");
      if (c.cats) sub += " · " + c.cats + " categories";
      return '<div class="cx-cat"><span class="cx-cat-name">' + esc(c.name) +
        "<i>" + esc(sub) + "</i></span>" +
        '<div class="cx-track"><i style="width:' + w + '%"></i></div>' +
        '<b class="cx-cat-val">' + esc(money(c.sum)) + "</b></div>";
    }).join("");
  }

  /* ---------- Compare tray ---------- */
  function loadFarmSteps() {
    if (farmTried) return;
    farmTried = true;
    fetch("../board.json")
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        var list = Array.isArray(data) ? data : data.rows;
        if (!Array.isArray(list)) return;
        farmBySlug = {};
        list.forEach(function (r) {
          if (r && r.slug && Array.isArray(r.farm_steps)) farmBySlug[r.slug] = r.farm_steps;
        });
        renderTray();
      })
      .catch(function () { /* farm plans stay in the detail view */ });
  }

  function metricRows(picked) {
    var defs = [
      ["Rank", function (r) { return "#" + r.rank; }],
      ["TVL", function (r) { return money(r.tvl_usd); }],
      ["Implied value", function (r) { return money(r.implied_value_usd); }],
      ["Category", function (r) { return r.category || "—"; }],
      ["7d growth", function (r) { return pct(r.change_7d); }],
      ["Age with no token", function (r) { return age(r.age_days); }],
      ["Chains", function (r) {
        var ch = r.chains || [];
        if (!ch.length) return "—";
        var shown = ch.slice(0, 3).join(", ");
        return ch.length + " — " + shown + (ch.length > 3 ? ", …" : "");
      }],
      ["Category multiple", function (r) { return mult(r.category_multiple); }],
      ["Growth multiplier", function (r) { return mult(r.growth_multiplier); }],
      ["Maturity multiplier", function (r) { return mult(r.maturity_multiplier); }],
      ["Chain multiplier", function (r) { return mult(r.chain_multiplier); }],
    ];
    return defs.map(function (d) {
      var cells = picked.map(function (r) {
        var v = d[1](r);
        var cls = "";
        if (d[0] === "7d growth" && r.change_7d != null) cls = r.change_7d >= 0 ? " cx-pos" : " cx-neg";
        return '<td class="cx-num' + cls + '">' + esc(v) + "</td>";
      }).join("");
      return '<tr><td class="cx-metric">' + esc(d[0]) + "</td>" + cells + "</tr>";
    }).join("");
  }

  function farmCells(picked) {
    return picked.map(function (r) {
      var steps = farmBySlug && farmBySlug[r.slug];
      if (steps && steps.length) {
        var items = steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
        return '<td><ol class="cx-steps">' + items + "</ol></td>";
      }
      return "<td>Farm plan: open this row's detail view — the plan is listed there.</td>";
    }).join("");
  }

  var traySig = ""; // signature of what the tray last rendered; re-render only on change

  function renderTray() {
    var tray = $("#cx-compare");
    if (!tray) return;
    if (!selected.length) {
      tray.hidden = true;
      tray.innerHTML = "";
      traySig = "";
      return;
    }
    var map = bySlug();
    var picked = selected.map(function (s) { return map[s]; }).filter(Boolean);
    if (!picked.length) {
      tray.hidden = true;
      tray.innerHTML = "";
      traySig = "";
      return;
    }
    loadFarmSteps();
    var sig = picked.map(function (r) { return r.slug; }).join(",") + "|" + (farmBySlug ? "1" : "0");
    if (sig === traySig && tray.innerHTML) return; // already showing this selection
    traySig = sig;
    var head = picked.map(function (r) {
      return "<th scope=\"col\">" + esc(r.name) + ' <span class="cx-sub">#' + r.rank + "</span></th>";
    }).join("");
    tray.innerHTML =
      '<div class="cx-compare-head"><h2>Compare — ' + picked.length + " of " + MAX_COMPARE + "</h2>" +
      '<button type="button" class="cx-clear">Clear comparison</button></div>' +
      '<p class="cx-sub">Tick up to three rows in the board. Untick a row to drop it.</p>' +
      '<p class="cx-hint" hidden>Compare holds at most three — untick one first.</p>' +
      '<div class="cx-table-wrap"><table class="cx-cmp-table"><thead><tr><th scope="col">Metric</th>' + head + "</tr></thead><tbody>" +
      metricRows(picked) +
      '<tr><td class="cx-metric">Farm plan</td>' + farmCells(picked) + "</tr>" +
      "</tbody></table></div>";
    tray.hidden = false;
    var clear = tray.querySelector(".cx-clear");
    if (clear) clear.addEventListener("click", function () {
      selected = [];
      renderTray();
      refreshChecks();
    });
  }

  function refreshChecks() {
    document.querySelectorAll("tbody tr[data-cx]").forEach(function (tr) {
      var box = tr.querySelector(".cx-cmp-cell input");
      if (!box) return;
      box.checked = selected.indexOf(box.getAttribute("data-slug")) >= 0;
    });
  }

  function onCheck(box) {
    var slug = box.getAttribute("data-slug");
    var hint = $("#cx-compare .cx-hint");
    if (box.checked) {
      if (selected.length >= MAX_COMPARE) {
        box.checked = false;
        if (hint) hint.hidden = false;
        return;
      }
      if (selected.indexOf(slug) < 0) selected.push(slug);
    } else {
      var at = selected.indexOf(slug);
      if (at >= 0) selected.splice(at, 1);
      if (hint) hint.hidden = true;
    }
    renderTray();
  }

  /* Attach a compare checkbox to every board row that has no token yet.
     The board re-renders on sort, filter and tab switch, so this runs
     after every render and only touches rows it has not marked yet.
     The board table is picked by its header text, never by position:
     the tray's own table sits earlier in the page and must not get one. */
  function boardTable() {
    var found = null;
    document.querySelectorAll("#board table").forEach(function (t) {
      var head = t.querySelector("thead");
      if (!head) return;
      var text = head.textContent || "";
      if (text.indexOf("Rank") >= 0 && text.indexOf("Implied value") >= 0) found = t;
    });
    return found;
  }

  function attachCheckboxes() {
    var table = boardTable();
    if (!table) return;
    var headRow = table.querySelector("thead tr");
    if (headRow && !headRow.querySelector(".cx-cmp-head")) {
      var th = document.createElement("th");
      th.scope = "col";
      th.className = "cx-cmp-head";
      th.textContent = "Compare";
      headRow.insertBefore(th, headRow.firstChild);
    }
    var map = bySlug();
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      if (tr.hasAttribute("data-cx")) return;
      var nameEl = tr.querySelector(".name b");
      if (!nameEl) { tr.setAttribute("data-cx", "skip"); return; }
      var name = nameEl.textContent.trim();
      var found = null;
      Object.keys(map).forEach(function (slug) {
        if (map[slug].name === name) found = map[slug];
      });
      if (!found) { tr.setAttribute("data-cx", "skip"); return; } // live-token row
      tr.setAttribute("data-cx", "1");
      var td = document.createElement("td");
      td.className = "cx-cmp-cell";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.setAttribute("aria-label", "Compare " + found.name);
      box.setAttribute("data-slug", found.slug);
      box.checked = selected.indexOf(found.slug) >= 0;
      box.addEventListener("click", function (ev) { ev.stopPropagation(); });
      box.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") ev.stopPropagation();
      });
      box.addEventListener("change", function () { onCheck(box); });
      td.appendChild(box);
      tr.insertBefore(td, tr.firstChild);
    });
  }

  /* The board re-renders its whole shell on sort, filter and tab switch,
     which wipes the charts section and the tray too. Rebuild them from
     the in-memory selection whenever they go missing. */
  function syncDom() {
    if (!$("#cx-charts")) buildCharts();
    if (selected.length) renderTray();
    attachCheckboxes();
  }

  function scheduleAttach() {
    if (attachTimer) return;
    attachTimer = setTimeout(function () {
      attachTimer = 0;
      syncDom();
    }, 60);
  }

  function buildCharts() {
    var shell = $("#board .shell");
    if (!shell) return false;
    if ($("#cx-charts")) return true; // already built
    var all = rows();
    if (!all.length) return false;
    var top = all.slice(0, TOP_N);
    var section = document.createElement("section");
    section.className = "panel cx-charts";
    section.id = "cx-charts";
    section.setAttribute("aria-label", "Charts");
    section.innerHTML =
      '<div class="cx-grid">' +
      '<div><h2>Top 10 by implied value</h2>' +
      '<p class="cx-sub">The ten strongest pre-token protocols, same numbers as the board below.</p>' +
      top10Svg(top) + "</div>" +
      "<div><h2>Where the value sits</h2>" +
      '<p class="cx-sub">Implied value summed by category, across all ' + all.length + " board rows.</p>" +
      categoryRows(all) + "</div></div>" +
      '<p class="cx-note">Charts are drawn from the same board data the page already ships — no extra source, no network.</p>';
    var controls = shell.querySelector(".controls");
    var panel = shell.querySelector(".panel");
    if (controls && controls.nextSibling) shell.insertBefore(section, controls.nextSibling);
    else if (panel) shell.insertBefore(section, panel);
    else shell.appendChild(section);

    var tray = document.createElement("section");
    tray.className = "panel cx-compare";
    tray.id = "cx-compare";
    tray.hidden = true;
    tray.setAttribute("aria-label", "Compare protocols");
    section.after(tray);
    return true;
  }

  function init(attempt) {
    attempt = attempt || 0;
    if (!window.RADAR || !rows().length) {
      if (attempt < 50) setTimeout(function () { init(attempt + 1); }, 100);
      return;
    }
    if (!buildCharts()) {
      if (attempt < 50) setTimeout(function () { init(attempt + 1); }, 100);
      return;
    }
    attachCheckboxes();
    var board = $("#board");
    if (board && window.MutationObserver) {
      new MutationObserver(scheduleAttach).observe(board, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(0); });
  } else {
    init(0);
  }
})();
