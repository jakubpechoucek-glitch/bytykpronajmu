// Byty k pronájmu – aplikace (přehled, detail bytu, finance, editace).
(function () {
  "use strict";

  const F = window.Finance;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => (t === null || t === undefined ? "" : String(t)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const DEMO = new URLSearchParams(location.search).has("demo");

  let uloziste = null;
  let data = null;
  let grafy = [];

  function dnes() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }
  const serazeneByty = () => [...data.byty].sort((a, b) => (a.poradi ?? 0) - (b.poradi ?? 0) || a.nazev.localeCompare(b.nazev, "cs"));
  const barvaBytu = (i) => getComputedStyle(document.documentElement).getPropertyValue(`--c${(i % 6) + 1}`).trim();
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // ============================================================== start
  async function start() {
    if (DEMO) {
      document.documentElement.classList.remove("auth-ceka");
      $("#demo-banner").hidden = false;
      uloziste = window.Data.pametoveUloziste(window.DEMO_DATA);
      $("#who").innerHTML = `<span>Ukázka</span><a href="./">Ostrá data</a>`;
    } else {
      const s = await window.RodinaAuth.vyzadujPrihlaseni();
      if (!s) return;
      uloziste = window.Data.supabaseUloziste(window.RodinaAuth.client);
      $("#who").innerHTML = `<span>${esc(s.jmeno)}</span><a href="/rozcestnik/">Rozcestník</a><button type="button" id="odhlasit">Odhlásit</button>`;
      $("#odhlasit").onclick = () => window.RodinaAuth.odhlasit();
    }
    try {
      await nacti();
    } catch (e) {
      $("#main").innerHTML = `<p class="err">Data se nepodařilo načíst: ${esc(e.message)}</p>`;
      return;
    }
    window.addEventListener("hashchange", vykresli);
    vykresli();
  }

  async function nacti() {
    data = await uloziste.nacti();
  }

  // ============================================================== router
  function vykresli() {
    grafy.forEach((g) => g.destroy());
    grafy = [];
    const h = location.hash.replace(/^#\/?/, "");
    const [cesta, param] = h.split("/");
    vykresliNav(cesta === "byt" ? param : cesta || "prehled");
    const main = $("#main");
    if (cesta === "byt") {
      const byt = data.byty.find((b) => b.id === decodeURIComponent(param || ""));
      if (byt) return vykresliByt(main, byt);
      main.innerHTML = `<p>Byt nenalezen. <a href="#/">Zpět na přehled</a></p>`;
    } else if (cesta === "finance") {
      vykresliFinance(main);
    } else {
      vykresliPrehled(main);
    }
    window.scrollTo(0, 0);
  }

  function vykresliNav(aktivni) {
    const odkazy = [["prehled", "#/", "Přehled"], ...serazeneByty().map((b) => [b.id, `#/byt/${encodeURIComponent(b.id)}`, b.nazev]), ["finance", "#/finance", "Finance"]];
    $("#nav").innerHTML = odkazy.map(([id, href, txt]) => `<a href="${href}" class="${id === aktivni ? "on" : ""}">${esc(txt)}</a>`).join("");
    const on = $("#nav .on");
    if (on) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // ============================================================== nápověda k ukazatelům
  // Krátké vysvětlení pro toho, kdo metriky nezná. Zobrazí se v bublině u „?".
  const NAPOVEDA = {
    hodnota: ["Tržní hodnota", "Odhad, za kolik by se byt dal prodat dnes: cena za m² z posledního odhadu (např. Atlas cen) × plocha bytu. Není to skutečná prodejní cena, jen orientační odhad."],
    porizeni: ["Pořizovací cena", "Kolik byt stál při koupi včetně vedlejších nákladů (daň, provize, právník). Od ní se počítá zhodnocení i výnosy."],
    zhodnoceni: ["Zhodnocení", "O kolik je byt dnes dražší než při koupi: (tržní hodnota − pořizovací cena) / pořizovací cena. Počítá jen růst ceny, nájmy v tom nejsou. Příklad: koupeno za 4 mil., dnes 6 mil. → +50 %."],
    proste: ["Prosté zhodnocení p.a.", "Celkové zhodnocení vydělené počtem let. Jednoduché, ale nadsazené – nepočítá s tím, že růst se „nabaluje“ (zdražuje se už zdražená cena). Přesnější je CAGR."],
    cagr: ["CAGR – průměrný roční růst", "O kolik procent by byt musel zdražovat každý rok stejně, aby se z pořizovací ceny dostal na dnešní hodnotu (se „složeným úročením“). Jen růst ceny, bez nájmů. Zobrazuje se až po roce držení. Vzorec: (hodnota / pořizovací cena)^(1/roky) − 1."],
    yield: ["Yield – nájemní výnos", "Kolik procent z pořizovací ceny vám ročně vydělá nájem: nájem za posledních 12 zapsaných měsíců / pořizovací cena. Je to hrubý výnos – před náklady (fond oprav, pojištění, daně, opravy). U bytů v ČR je běžné zhruba 3–5 %."],
    yieldHodnota: ["Yield z hodnoty", "Roční nájem / dnešní tržní hodnota. Říká, kolik vydělávají peníze, které jsou v bytě dnes „uložené“. Hodí se pro srovnání s jinými investicemi (spořicí účet, dluhopisy) – kdybyste byt prodal, tolik byste museli jinde vydělat, abyste na tom byli stejně."],
    yieldNom: ["Yield nominální (za rok)", "Nájem vybraný v daném roce / pořizovací cena. Roky, kdy byt nebyl celý rok pronajatý (koupě, výměna nájemníka), vycházejí nižší."],
    yieldReal: ["Yield reálný", "Nominální yield očištěný o inflaci: (1 + yield) / (1 + inflace) − 1. Ukazuje skutečný přírůstek kupní síly. Záporné číslo = nájem v tom roce nestačil vyrovnat znehodnocení peněz inflací."],
    inflace: ["Inflace", "Průměrná roční míra inflace podle ČSÚ – o kolik v průměru zdražilo zboží a služby, tedy o kolik ztratily peníze hodnotu."],
    irr: ["IRR – vnitřní výnosové procento", "Celkový roční výnos investice, který bere v úvahu všechno a v čase, kdy se to stalo: zaplacenou kupní cenu, každý měsíční nájem a dnešní hodnotu bytu (jako byste ho dnes prodali). Je to úrok, který by vám musel dávat účet, abyste skončili se stejným výsledkem. Čím vyšší, tím lépe – hodnocení viz Pásma IRR na stránce Finance."],
    irrHodnota: ["IRR bez nájmů", "Výnos jen z růstu cen: nákupy bytů a jejich dnešní hodnota, bez nájmů. Rozdíl proti celkovému IRR ukazuje, kolik přidávají nájmy."],
    pasmo: ["Pásmo IRR", "Slovní hodnocení výnosu: pod 4 % slabé, 4–6 % konzervativní, 6–9 % solidní, 9–12 % výborné, nad 12 % skvělé, ale obvykle s vyšším rizikem."],
    najemMesic: ["Nájem / měsíc", "Součet měsíčních nájmů podle smluv, které dnes běží. Byt bez platné smlouvy se nepočítá."],
    najemCelkem: ["Nájemné celkem", "Součet všeho zapsaného nájemného od koupe bytu – hrubě, bez nákladů a daní."],
    kumulace: ["Kumulace nájmu", "Průběžný součet nájemného od koupě až do daného roku."],
    hodnotaRok: ["Hodnota ke konci roku", "Odhadnutá hodnota bytu na konci roku – dopočtená rovnoměrně mezi cenou při koupi a jednotlivými odhady. Aktuální rok = dnešní hodnota."],
    odpis: ["Daňový odpis", "Částka, kterou si můžete každý rok odečíst od příjmů z nájmu jako náklad, a snížit tak daň. Nejde o skutečný výdaj. Byt (odpisová skupina 5) se odpisuje 30 let: 1. rok 1,4 %, další roky 3,4 % ze vstupní ceny."],
    drzeno: ["Drženo", "Jak dlouho byt vlastníte – od data koupě do dneška."],
  };
  const napoveda = (k) => `<button type="button" class="help" data-help="${k}" aria-label="Co je ${esc(NAPOVEDA[k][0])}?">?</button>`;
  const th = (txt, k, num = true) => `<th${num ? ' class="num"' : ""}>${txt}${k ? napoveda(k) : ""}</th>`;

  // Bublina: na počítači při najetí myší, na dotykovém displeji klepnutím
  function zapniNapovedu() {
    const bub = document.createElement("div");
    bub.className = "bublina";
    bub.setAttribute("role", "tooltip");
    bub.hidden = true;
    document.body.appendChild(bub);
    let pripnuto = null;

    function ukaz(btn) {
      const [nazev, text] = NAPOVEDA[btn.dataset.help];
      bub.innerHTML = `<b>${esc(nazev)}</b><span>${esc(text)}</span>`;
      bub.hidden = false;
      const r = btn.getBoundingClientRect();
      const w = Math.min(320, window.innerWidth - 24);
      bub.style.width = w + "px";
      const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
      const h = bub.offsetHeight;
      const top = r.bottom + 8 + h < window.innerHeight ? r.bottom + 8 : Math.max(8, r.top - h - 8);
      bub.style.left = left + window.scrollX + "px";
      bub.style.top = top + window.scrollY + "px";
    }
    const skryj = () => { bub.hidden = true; pripnuto = null; };

    document.addEventListener("mouseover", (e) => {
      const b = e.target.closest(".help");
      if (b && !pripnuto) ukaz(b);
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(".help") && !pripnuto) bub.hidden = true;
    });
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".help");
      if (b) {
        e.preventDefault();
        e.stopPropagation();
        if (pripnuto === b) return skryj();
        pripnuto = b;
        ukaz(b);
      } else if (!e.target.closest(".bublina")) {
        skryj();
      }
    }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") skryj(); });
    window.addEventListener("hashchange", skryj);
    window.addEventListener("resize", skryj);
  }

  // ============================================================== drobnosti
  const kpi = (l, v, s = "", cls = "", k = null) => `<div class="kpi ${cls}"><div class="l">${l}${k ? napoveda(k) : ""}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  const znamenko = (v, txt) => (v === null || v === undefined ? txt : `<span class="${v >= 0 ? "pos" : "neg"}">${v > 0 ? "+" : ""}${txt}</span>`);
  const pct = (v, des) => F.fmtPct(v, des);

  function stavPronajmu(p) {
    const t = F.d(dnes());
    if (F.d(p.od) > t) return `<span class="badge mut">budoucí</span>`;
    if (!p.do || F.d(p.do) >= t) return `<span class="badge ok">běží</span>`;
    return `<span class="badge mut">skončila</span>`;
  }

  function toast(text, chyba = false) {
    const el = $("#toast");
    el.textContent = text;
    el.className = "toast" + (chyba ? " err" : "");
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (el.hidden = true), chyba ? 6000 : 2200);
  }

  async function provest(akce, hlaska = "Uloženo") {
    try {
      await akce();
      await nacti();
      vykresli();
      toast(hlaska);
    } catch (e) {
      toast(e.message || String(e), true);
      throw e;
    }
  }

  // ============================================================== formuláře
  const POLE = {
    byt: [
      { k: "nazev", l: "Název", t: "text", req: true },
      { k: "adresa", l: "Adresa", t: "text", wide: true },
      { k: "dispozice", l: "Dispozice", t: "text" },
      { k: "plocha_m2", l: "Plocha [m²]", t: "num" },
      { k: "patro", l: "Patro", t: "text" },
      { k: "garazova_stani", l: "Garážová stání", t: "int" },
      { k: "sklep_m2", l: "Sklep [m²]", t: "num" },
      { k: "posledni_vymalba", l: "Poslední výmalba (rok)", t: "int" },
      { k: "vybaveni", l: "Vybavení", t: "text", wide: true },
      { k: "porizeni_datum", l: "Datum pořízení", t: "date" },
      { k: "porizeni_cena", l: "Pořizovací cena [Kč]", t: "num" },
      { k: "odpisy_vstupni_cena", l: "Vstupní cena pro odpisy [Kč]", t: "num", help: "Prázdné = pořizovací cena" },
      { k: "poradi", l: "Pořadí v menu", t: "int" },
      { k: "odkaz_mapa", l: "Odkaz – mapa", t: "url", wide: true },
      { k: "odkaz_fotogalerie", l: "Odkaz – fotogalerie", t: "url", wide: true },
      { k: "odkaz_smlouvy", l: "Odkaz – složka se smlouvami", t: "url", wide: true },
      { k: "poznamka", l: "Poznámka", t: "area", wide: true },
    ],
    pronajem: [
      { k: "najemce", l: "Nájemce", t: "text", req: true },
      { k: "kontakt", l: "Kontakt (e-mail, telefon)", t: "text" },
      { k: "od", l: "Od", t: "date", req: true },
      { k: "do", l: "Do", t: "date", help: "Prázdné = doba neurčitá" },
      { k: "najem_mesic", l: "Nájem / měsíc [Kč]", t: "num" },
      { k: "kauce", l: "Kauce [Kč]", t: "num" },
      { k: "splatnost_den", l: "Splatnost (den v měsíci)", t: "int" },
      { k: "ucet", l: "Na účet", t: "text" },
      { k: "poznamka", l: "Poznámka", t: "area", wide: true },
    ],
    odhad: [
      { k: "datum", l: "Datum odhadu", t: "date", req: true },
      { k: "cena_m2", l: "Cena za m² [Kč]", t: "num", req: true },
      { k: "zdroj", l: "Zdroj", t: "text", def: "Atlas cen" },
      { k: "odkaz", l: "Odkaz", t: "url", wide: true },
    ],
    hypoteka: [
      { k: "vyse", l: "Výše hypotéky [Kč]", t: "num" },
      { k: "splatka_mesic", l: "Splátka / měsíc [Kč]", t: "num" },
      { k: "sazba", l: "Úroková sazba [%]", t: "pct" },
      { k: "fixace_let", l: "Fixace [roky]", t: "int" },
      { k: "konec_fixace", l: "Konec fixace", t: "date" },
      { k: "splacena", l: "Splacená", t: "bool" },
      { k: "poznamka", l: "Poznámka", t: "area", wide: true },
    ],
    inflace: [
      { k: "rok", l: "Rok", t: "int", req: true },
      { k: "mira", l: "Průměrná roční inflace [%]", t: "pct", req: true },
    ],
  };

  function cislo(s) {
    const t = String(s).replace(/[\s ]/g, "").replace(",", ".").replace(/kč$/i, "");
    if (t === "") return null;
    const n = Number(t);
    if (!isFinite(n)) throw new Error(`„${s}“ není číslo.`);
    return n;
  }
  const naVstup = (v) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

  function pole(p, v) {
    const id = `f-${p.k}`;
    const val = v ?? p.def ?? "";
    let input;
    if (p.t === "area") input = `<textarea id="${id}" name="${p.k}">${esc(val)}</textarea>`;
    else if (p.t === "bool") return `<div class="f ${p.wide ? "wide" : ""}"><label class="check"><input type="checkbox" id="${id}" name="${p.k}" ${val ? "checked" : ""}> ${p.l}</label></div>`;
    else if (p.t === "date") input = `<input type="date" id="${id}" name="${p.k}" value="${esc(val ? String(val).slice(0, 10) : "")}" ${p.req ? "required" : ""}>`;
    else if (p.t === "url") input = `<input type="url" id="${id}" name="${p.k}" value="${esc(val)}" placeholder="https://…">`;
    else if (p.t === "pct") input = `<input type="text" inputmode="decimal" id="${id}" name="${p.k}" value="${val === "" ? "" : esc(naVstup(+(Number(val) * 100).toFixed(4)))}" ${p.req ? "required" : ""}>`;
    else if (p.t === "num" || p.t === "int") input = `<input type="text" inputmode="${p.t === "int" ? "numeric" : "decimal"}" id="${id}" name="${p.k}" value="${esc(naVstup(val))}" ${p.req ? "required" : ""}>`;
    else input = `<input type="text" id="${id}" name="${p.k}" value="${esc(val)}" ${p.req ? "required" : ""}>`;
    return `<div class="f ${p.wide ? "wide" : ""}"><label for="${id}">${p.l}${p.req ? " *" : ""}</label>${input}${p.help ? `<span class="help">${p.help}</span>` : ""}</div>`;
  }

  function hodnotyFormulare(pole_, form) {
    const out = {};
    for (const p of pole_) {
      const el = form.elements[p.k];
      if (p.t === "bool") { out[p.k] = el.checked; continue; }
      const raw = el.value.trim();
      if (p.req && raw === "") throw new Error(`Vyplň pole „${p.l}“.`);
      if (p.t === "num") out[p.k] = cislo(raw);
      else if (p.t === "int") { const n = cislo(raw); if (n !== null && !Number.isInteger(n)) throw new Error(`„${p.l}“ musí být celé číslo.`); out[p.k] = n; }
      else if (p.t === "pct") { const n = cislo(raw); out[p.k] = n === null ? null : +(n / 100).toFixed(7); }
      else out[p.k] = raw === "" ? null : raw;
    }
    return out;
  }

  // Otevře dialog; ulozit(hodnoty) / smazat() vrací Promise
  function formular({ titulek, pole: pole_, hodnoty = {}, ulozit, smazat }) {
    const dlg = $("#dlg"), form = $("#dlg-form"), err = $("#dlg-err"), del = $("#dlg-del");
    $("#dlg-title").textContent = titulek;
    $("#dlg-fields").innerHTML = pole_.map((p) => pole(p, hodnoty[p.k])).join("");
    err.hidden = true;
    del.hidden = !smazat;
    const zavri = () => dlg.close();
    $("#dlg-cancel").onclick = zavri;
    del.onclick = async () => {
      if (!confirm("Opravdu smazat?")) return;
      try { await provest(smazat, "Smazáno"); zavri(); } catch (e) { err.textContent = e.message; err.hidden = false; }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      err.hidden = true;
      let vals;
      try { vals = hodnotyFormulare(pole_, form); } catch (e2) { err.textContent = e2.message; err.hidden = false; return; }
      try { await provest(() => ulozit(vals)); zavri(); } catch (e2) { err.textContent = e2.message; err.hidden = false; }
    };
    dlg.showModal();
    const prvni = form.querySelector("input, textarea");
    if (prvni) prvni.focus();
  }

  function slug(t) {
    const s = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "byt";
    let id = s, i = 2;
    while (data.byty.some((b) => b.id === id)) id = `${s}-${i++}`;
    return id;
  }

  function upravitByt(byt) {
    formular({
      titulek: byt ? `Upravit: ${byt.nazev}` : "Nový byt",
      pole: POLE.byt,
      hodnoty: byt || { poradi: data.byty.length + 1 },
      ulozit: async (v) => {
        if (byt) return uloziste.uloz("byty", v, byt);
        const id = slug(v.nazev);
        await uloziste.uloz("byty", { ...v, id }, null);
        location.hash = `#/byt/${encodeURIComponent(id)}`;
      },
      smazat: byt ? async () => { await uloziste.smaz("byty", byt); location.hash = "#/"; } : null,
    });
  }

  function upravitZaznam(tabulka, poleKey, titulek, byt, zaznam, vychozi = {}) {
    formular({
      titulek,
      pole: POLE[poleKey],
      hodnoty: zaznam || vychozi,
      ulozit: (v) => uloziste.uloz(tabulka, { ...v, byt_id: byt.id }, zaznam),
      smazat: zaznam ? () => uloziste.smaz(tabulka, zaznam) : null,
    });
  }

  // ============================================================== přehled
  function vykresliPrehled(main) {
    const den = dnes();
    if (!data.byty.length) {
      main.innerHTML = `<h1>Přehled</h1><p class="sub">Zatím tu není žádný byt.</p><button class="btn primary" id="novy">+ Přidat byt</button>`;
      $("#novy").onclick = () => upravitByt(null);
      return;
    }
    const p = F.portfolio(data, den);
    const upoz = F.upozorneni(data, den);
    const indexy = Object.fromEntries(serazeneByty().map((b, i) => [b.id, i]));

    main.innerHTML = `
      <div class="page-head">
        <div><h1>Přehled</h1><p class="sub">${data.byty.length} ${data.byty.length < 5 ? "byty" : "bytů"} · stav k ${F.fmtDatum(den)}</p></div>
        <button class="btn" id="novy">+ Přidat byt</button>
      </div>
      <div class="kpis">
        ${kpi("Hodnota portfolia", F.fmtMil(p.V), `pořízeno za ${F.fmtMil(p.P)}`, "hero", "hodnota")}
        ${kpi("Zhodnocení", znamenko(p.V - p.P, F.fmtMil(p.V - p.P)), znamenko(p.zhodnoceni, pct(p.zhodnoceni, 1)), "", "zhodnoceni")}
        ${kpi("Nájem / měsíc", F.fmtKc(p.najemMesic), "podle běžících smluv", "", "najemMesic")}
        ${kpi("Yield", pct(p.yield12), `posl. 12 zapsaných měs. · z hodnoty ${pct(p.yield12Hodnota)}`, "", "yield")}
        ${kpi("IRR celkem", pct(p.irrCelkem), `hodnota + nájmy · bez nájmů ${pct(p.irrHodnota)}`, "", "irr")}
        ${kpi("Nájemné celkem", F.fmtMil(p.najemCelkem), "vše zapsané od pořízení", "", "najemCelkem")}
      </div>
      ${upoz.length ? `<section class="card"><h2>Upozornění</h2><ul class="alerts">
        ${upoz.map((u) => `<li class="${u.uroven}"><span><a href="#/byt/${encodeURIComponent(u.byt.id)}">${esc(u.byt.nazev)}</a> – ${esc(u.text)}</span></li>`).join("")}
      </ul></section>` : ""}
      <section class="card">
        <h2>Byty</h2>
        <div class="scroll"><table class="tbl">
          <thead><tr><th>Byt</th><th>Dispozice</th><th class="num">m²</th><th>Smlouva do</th><th class="num">Nájem/měs.</th>
            ${th("Hodnota", "hodnota")}${th("Zhodnocení", "zhodnoceni")}${th("CAGR", "cagr")}${th("Yield", "yield")}${th("IRR", "irr")}</tr></thead>
          <tbody>${p.souhrny.map((s) => `
            <tr class="click" data-byt="${esc(s.byt.id)}">
              <td><span class="byt-name"><span class="dot" style="background:${barvaBytu(indexy[s.byt.id])}"></span>${esc(s.byt.nazev)}</span></td>
              <td>${esc(s.byt.dispozice)}</td>
              <td class="num">${s.byt.plocha_m2 ? naVstup(Number(s.byt.plocha_m2)) : "—"}</td>
              <td>${s.aktivni ? (s.aktivni.do ? F.fmtDatum(s.aktivni.do) : "neurčito") : `<span class="badge err">bez smlouvy</span>`}</td>
              <td class="num">${F.fmtKc(s.najemMesic)}</td>
              <td class="num">${F.fmtKc(s.V)}</td>
              <td class="num">${znamenko(s.zhodnoceni, pct(s.zhodnoceni, 1))}</td>
              <td class="num">${s.cagr !== null ? pct(s.cagr) : `<span class="muted" title="Drženo méně než rok">&lt; 1 rok</span>`}</td>
              <td class="num">${pct(s.yield12)}</td>
              <td class="num">${pct(s.irr)}</td>
            </tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="4">Celkem</td><td class="num">${F.fmtKc(p.najemMesic)}</td><td class="num">${F.fmtKc(p.V)}</td>
            <td class="num">${znamenko(p.zhodnoceni, pct(p.zhodnoceni, 1))}</td><td></td><td class="num">${pct(p.yield12)}</td><td class="num">${pct(p.irrCelkem)}</td></tr></tfoot>
        </table></div>
        <p class="note">Yield = nájem za posledních 12 zapsaných měsíců / pořizovací cena. IRR = vnitřní výnos z pořizovací ceny, měsíčních nájmů a dnešní odhadní hodnoty.</p>
      </section>
      <div class="cols">
        <section class="card"><h2>Hodnota portfolia</h2><div class="chart"><canvas id="g-hodnota"></canvas></div></section>
        <section class="card"><h2>Nájemné po letech</h2><div class="chart"><canvas id="g-najem"></canvas></div></section>
      </div>`;

    $("#novy").onclick = () => upravitByt(null);
    $$("tr[data-byt]", main).forEach((tr) => (tr.onclick = () => (location.hash = `#/byt/${encodeURIComponent(tr.dataset.byt)}`)));

    const v = F.vyvojHodnoty(data, den);
    graf("g-hodnota", {
      type: "line",
      data: { labels: v.roky, datasets: v.rady.map((r, i) => ({ label: r.byt.nazev, data: r.hodnoty, fill: true, borderColor: barvaBytu(i), backgroundColor: barvaBytu(i) + "55", pointRadius: 0, tension: 0.15 })) },
      options: { scales: { y: { stacked: true, beginAtZero: true, ticks: { callback: (x) => x / 1e6 + " mil." } } }, interaction: { mode: "index", intersect: false } },
      kc: true,
    });
    graf("g-najem", {
      type: "bar",
      data: { labels: v.roky, datasets: v.rady.map((r, i) => ({ label: r.byt.nazev, data: r.najmy, backgroundColor: barvaBytu(i) })) },
      options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (x) => x / 1000 + " tis." } } }, interaction: { mode: "index", intersect: false } },
      kc: true,
    });
  }

  function graf(id, cfg) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    const text = css("--text"), line = css("--line"), muted = css("--muted");
    Chart.defaults.font.family = "Inter, sans-serif";
    Chart.defaults.color = muted;
    const opt = cfg.options || {};
    opt.maintainAspectRatio = false;
    opt.plugins = { legend: { position: "bottom", labels: { boxWidth: 10, color: text } }, ...(opt.plugins || {}) };
    if (cfg.kc) opt.plugins.tooltip = { callbacks: { label: (c) => `${c.dataset.label}: ${F.fmtKc(c.parsed.y)}` } };
    for (const ax of Object.values(opt.scales || {})) ax.grid = { color: line, ...(ax.grid || {}) };
    grafy.push(new Chart(el, { type: cfg.type, data: cfg.data, options: opt }));
  }

  // ============================================================== detail bytu
  function vykresliByt(main, byt) {
    const den = dnes();
    const s = F.souhrnBytu(byt, data, den);
    const roky = F.rocniPrehled(byt, data, den);
    const pron = F.pronajmyBytu(byt, data.pronajmy);
    const odhady = data.odhady.filter((o) => o.byt_id === byt.id).sort((a, b) => (a.datum < b.datum ? 1 : -1));
    const hyp = s.hypoteky;
    const upoz = F.upozorneni({ ...data, byty: [byt] }, den);
    const pasmo = F.pasmo(s.irr);
    const maOdkazy = byt.odkaz_mapa || byt.odkaz_fotogalerie || byt.odkaz_smlouvy;
    const radekInfo = (l, v) => (v === null || v === undefined || v === "" ? "" : `<dt>${l}</dt><dd>${v}</dd>`);

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${esc(byt.nazev)}</h1>
          <p class="sub">${[esc(byt.adresa), esc(byt.dispozice), byt.plocha_m2 ? `${naVstup(byt.plocha_m2)} m²` : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <button class="btn" id="upravit-byt">Upravit byt</button>
      </div>

      <div class="kpis">
        ${kpi("Tržní hodnota", F.fmtMil(s.V), s.hodnotaDatum ? `odhad ${F.fmtDatum(s.hodnotaDatum)}${s.cenaM2Odhad ? ` · ${F.fmtKc(s.cenaM2Odhad)}/m²` : ""}` : "", "hero", "hodnota")}
        ${kpi("Pořízení", F.fmtMil(s.P), `${F.fmtDatum(byt.porizeni_datum)}${s.cenaM2Porizeni ? ` · ${F.fmtKc(s.cenaM2Porizeni)}/m²` : ""}`, "", "porizeni")}
        ${kpi("Zhodnocení", znamenko(s.zhodnoceni, pct(s.zhodnoceni, 1)), s.prosteZhodnoceniPa !== null ? `prostě ${pct(s.prosteZhodnoceniPa)} p.a.` : s.V && s.P ? znamenko(s.V - s.P, F.fmtKc(s.V - s.P)) : "", "", "zhodnoceni")}
        ${kpi("CAGR", s.cagr !== null ? pct(s.cagr) : "—", s.cagr !== null ? `za ${naVstup(s.n.toFixed(1))} roku` : "drženo méně než rok", "", "cagr")}
        ${kpi("Yield", pct(s.yield12), `${s.posledniNajem ? `12 měs. do ${F.fmtMesic(s.posledniNajem.mesic)} · ` : ""}z hodnoty ${pct(s.yield12Hodnota)}`, "", "yield")}
        ${kpi("IRR", pct(s.irr), pasmo ? `${pasmo.nazev}: ${pasmo.text.split(",")[0].toLowerCase()}` : "drženo méně než rok", "", "irr")}
      </div>

      ${upoz.length ? `<section class="card"><h2>Upozornění</h2><ul class="alerts">${upoz.map((u) => `<li class="${u.uroven}"><span>${esc(u.text)}</span></li>`).join("")}</ul></section>` : ""}

      <div class="cols">
        <section class="card">
          <h2>Základní info</h2>
          <dl class="info">
            ${radekInfo("Dispozice", esc(byt.dispozice))}
            ${radekInfo("Plocha", byt.plocha_m2 ? `${naVstup(byt.plocha_m2)} m²` : "")}
            ${radekInfo("Patro", esc(byt.patro))}
            ${radekInfo("Garážová stání", byt.garazova_stani)}
            ${radekInfo("Sklep", byt.sklep_m2 ? `${naVstup(byt.sklep_m2)} m²` : "")}
            ${radekInfo("Vybavení", esc(byt.vybaveni))}
            ${radekInfo("Poslední výmalba", byt.posledni_vymalba)}
            ${radekInfo("Poznámka", esc(byt.poznamka))}
          </dl>
          ${maOdkazy ? `<div class="links">
            ${byt.odkaz_mapa ? `<a href="${esc(byt.odkaz_mapa)}" target="_blank" rel="noopener">📍 Mapa</a>` : ""}
            ${byt.odkaz_fotogalerie ? `<a href="${esc(byt.odkaz_fotogalerie)}" target="_blank" rel="noopener">🖼 Fotogalerie</a>` : ""}
            ${byt.odkaz_smlouvy ? `<a href="${esc(byt.odkaz_smlouvy)}" target="_blank" rel="noopener">📄 Smlouvy</a>` : ""}
          </div>` : ""}
        </section>
        <section class="card">
          <div class="card-head"><h2>Hypotéka</h2><button class="btn small" id="nova-hyp">+ Přidat</button></div>
          ${hyp.length ? hyp.map((h) => `
            <dl class="info" style="margin-bottom:12px">
              ${radekInfo("Stav", h.splacena ? `<span class="badge ok">splacená</span>` : `<span class="badge warn">splácí se</span>`)}
              ${radekInfo("Výše", F.fmtKc(h.vyse))}
              ${radekInfo("Splátka", h.splatka_mesic ? F.fmtKc(h.splatka_mesic) + " / měs." : "")}
              ${radekInfo("Sazba", h.sazba !== null && h.sazba !== undefined ? pct(Number(h.sazba)) : "")}
              ${radekInfo("Fixace", h.fixace_let ? `${h.fixace_let} ${h.fixace_let < 5 ? "roky" : "let"}` : "")}
              ${radekInfo("Konec fixace", h.konec_fixace ? F.fmtDatum(h.konec_fixace) : "")}
              ${radekInfo("Poznámka", esc(h.poznamka))}
            </dl>
            <button class="btn small" data-hyp="${h.id}">Upravit</button>`).join("") : `<p class="muted">Bez hypotéky.</p>`}
        </section>
      </div>

      <section class="card" style="margin-top:20px">
        <div class="card-head"><h2>Pronájmy</h2><button class="btn small" id="novy-pronajem">+ Nová smlouva</button></div>
        ${pron.length ? `<div class="scroll"><table class="tbl">
          <thead><tr><th>#</th><th>Nájemce</th><th>Od</th><th>Do</th><th></th><th class="num">Nájem</th><th class="num">Kauce</th><th class="num">Splatnost</th><th>Účet</th><th>Kontakt</th><th></th></tr></thead>
          <tbody>${pron.map((p, i) => `<tr>
            <td class="muted">${i + 1}.</td><td><b>${esc(p.najemce)}</b>${p.poznamka ? `<div class="muted" style="font-size:.8rem">${esc(p.poznamka)}</div>` : ""}</td>
            <td>${F.fmtDatum(p.od)}</td><td>${p.do ? F.fmtDatum(p.do) : "neurčito"}</td><td>${stavPronajmu(p)}</td>
            <td class="num">${F.fmtKc(p.najem_mesic)}</td><td class="num">${F.fmtKc(p.kauce)}</td>
            <td class="num">${p.splatnost_den ? `do ${p.splatnost_den}.` : "—"}</td><td>${esc(p.ucet)}</td>
            <td>${p.kontakt ? (p.kontakt.includes("@") ? `<a href="mailto:${esc(p.kontakt)}">${esc(p.kontakt)}</a>` : esc(p.kontakt)) : ""}</td>
            <td><button class="icon-btn" data-pronajem="${p.id}" title="Upravit">✎</button></td>
          </tr>`).join("")}</tbody></table></div>` : `<p class="muted">Zatím žádná smlouva.</p>`}
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Nájemné po měsících</h2>
          <div class="actions"><button class="btn small" id="doplnit">Doplnit podle smluv</button><button class="btn small" id="dalsi-rok">+ Rok</button></div>
        </div>
        <div class="scroll" id="najem-grid">${gridNajmu(byt, roky)}</div>
        <p class="note">Skutečně zaplacené nájemné. Prázdná buňka = nezaplaceno / neobsazeno. „Doplnit podle smluv“ vyplní prázdné měsíce do dneška částkou z platné smlouvy.</p>
      </section>

      <div class="cols">
        <section class="card">
          <div class="card-head"><h2>Odhady tržní ceny</h2><button class="btn small" id="novy-odhad">+ Nový odhad</button></div>
          ${odhady.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Datum</th><th class="num">Kč/m²</th><th class="num">Hodnota</th><th>Zdroj</th><th></th></tr></thead><tbody>
            ${odhady.map((o) => `<tr><td>${F.fmtDatum(o.datum)}</td><td class="num">${F.fmtKc(o.cena_m2)}</td><td class="num">${F.fmtKc(o.cena_m2 * byt.plocha_m2)}</td>
              <td>${o.odkaz ? `<a href="${esc(o.odkaz)}" target="_blank" rel="noopener">${esc(o.zdroj || "odkaz")}</a>` : esc(o.zdroj)}</td>
              <td><button class="icon-btn" data-odhad="${o.id}" title="Upravit">✎</button></td></tr>`).join("")}
          </tbody></table></div>` : `<p class="muted">Bez odhadu – jako hodnota se bere pořizovací cena.</p>`}
        </section>
        <section class="card"><h2>Nájem a yield po letech</h2><div class="chart"><canvas id="g-byt"></canvas></div></section>
      </div>

      <section class="card" style="margin-top:20px">
        <h2>Po letech</h2>
        <div class="scroll"><table class="tbl">
          <thead><tr><th>Rok</th><th class="num">Měsíců</th><th class="num">Nájem</th>${th("Yield nom.", "yieldNom")}${th("Inflace", "inflace")}${th("Yield reál.", "yieldReal")}
            ${th("Hodnota", "hodnotaRok")}${th("Yield z hodnoty", "yieldHodnota")}${th("Kumulace nájmu", "kumulace")}${th("Daňový odpis", "odpis")}</tr></thead>
          <tbody>${[...roky].reverse().map((r) => `<tr>
            <td><b>${r.rok}</b></td><td class="num">${r.mesicu}</td><td class="num">${F.fmtKc(r.najem)}</td><td class="num">${pct(r.yieldNom)}</td>
            <td class="num">${pct(r.inflace, 1)}</td><td class="num">${r.yieldReal !== null ? znamenko(r.yieldReal, pct(r.yieldReal)) : "—"}</td>
            <td class="num">${F.fmtKc(r.hodnota)}</td><td class="num">${pct(r.yieldHodnota)}</td><td class="num">${F.fmtKc(r.kumulace)}</td><td class="num">${F.fmtKc(r.odpis)}</td>
          </tr>`).join("")}</tbody>
        </table></div>
        <p class="note">Yield nominální = roční nájem / pořizovací cena; reálný = (1 + nominální) / (1 + inflace) − 1. Hodnota ke konci roku je dopočtená lineárně mezi pořízením a odhady.</p>
      </section>`;

    // akce
    $("#upravit-byt").onclick = () => upravitByt(byt);
    $("#novy-pronajem").onclick = () => {
      const posl = pron[pron.length - 1];
      upravitZaznam("pronajmy", "pronajem", "Nová nájemní smlouva", byt, null,
        posl ? { najem_mesic: posl.najem_mesic, kauce: posl.kauce, splatnost_den: posl.splatnost_den, ucet: posl.ucet } : {});
    };
    $$("[data-pronajem]", main).forEach((b) => (b.onclick = () => upravitZaznam("pronajmy", "pronajem", "Upravit smlouvu", byt, pron.find((p) => String(p.id) === b.dataset.pronajem))));
    $("#novy-odhad").onclick = () => upravitZaznam("odhady", "odhad", "Nový odhad ceny", byt, null, { datum: dnes(), zdroj: "Atlas cen" });
    $$("[data-odhad]", main).forEach((b) => (b.onclick = () => upravitZaznam("odhady", "odhad", "Upravit odhad", byt, odhady.find((o) => String(o.id) === b.dataset.odhad))));
    $("#nova-hyp").onclick = () => upravitZaznam("hypoteky", "hypoteka", "Nová hypotéka", byt, null);
    $$("[data-hyp]", main).forEach((b) => (b.onclick = () => upravitZaznam("hypoteky", "hypoteka", "Upravit hypotéku", byt, hyp.find((h) => String(h.id) === b.dataset.hyp))));
    $("#doplnit").onclick = () => doplnitPodleSmluv(byt);
    $("#dalsi-rok").onclick = () => {
      const g = $("#najem-grid");
      const posledni = Math.max(...$$("tr[data-rok]", g).map((tr) => +tr.dataset.rok));
      g.querySelector("tbody").insertAdjacentHTML("afterbegin", radekNajmu(byt, posledni + 1));
      napojGrid(byt);
    };
    napojGrid(byt);

    graf("g-byt", {
      type: "bar",
      data: {
        labels: roky.map((r) => r.rok),
        datasets: [
          { type: "bar", label: "Nájem", data: roky.map((r) => r.najem), backgroundColor: css("--c1"), yAxisID: "y" },
          { type: "line", label: "Yield nom.", data: roky.map((r) => (r.yieldNom * 100).toFixed(2)), borderColor: css("--lit"), backgroundColor: css("--lit"), yAxisID: "y2", tension: 0.2 },
          { type: "line", label: "Yield reál.", data: roky.map((r) => (r.yieldReal === null ? null : (r.yieldReal * 100).toFixed(2))), borderColor: css("--c4"), backgroundColor: css("--c4"), borderDash: [4, 4], yAxisID: "y2", tension: 0.2 },
        ],
      },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { position: "left", ticks: { callback: (x) => x / 1000 + " tis." } },
          y2: { position: "right", grid: { display: false }, ticks: { callback: (x) => x + " %" } },
        },
        plugins: { tooltip: { callbacks: { label: (c) => (c.dataset.yAxisID === "y2" ? `${c.dataset.label}: ${String(c.parsed.y).replace(".", ",")} %` : `${c.dataset.label}: ${F.fmtKc(c.parsed.y)}`) } } },
      },
    });
  }

  // ------------------------------------------------------------ měsíční grid
  function najemMapa(byt) {
    return Object.fromEntries(data.najemne.filter((n) => n.byt_id === byt.id).map((n) => [String(n.mesic).slice(0, 7), n]));
  }

  function radekNajmu(byt, rok, mapa = najemMapa(byt)) {
    let sum = 0;
    const bunky = [];
    for (let m = 1; m <= 12; m++) {
      const k = `${rok}-${String(m).padStart(2, "0")}`;
      const n = mapa[k];
      if (n) sum += Number(n.castka);
      bunky.push(`<td><input data-mesic="${k}" inputmode="numeric" value="${n ? esc(Number(n.castka)) : ""}" placeholder=" " aria-label="${F.MESICE[m - 1]} ${rok}"></td>`);
    }
    return `<tr data-rok="${rok}"><td class="rok">${rok}</td>${bunky.join("")}<td class="num sum">${F.fmtKc(sum)}</td></tr>`;
  }

  function gridNajmu(byt, roky) {
    const mapa = najemMapa(byt);
    const r = roky.map((x) => x.rok).reverse();
    return `<table class="grid-najem"><thead><tr><th></th>${F.MESICE.map((m) => `<th>${m.slice(0, 3)}</th>`).join("")}<th class="num">Celkem</th></tr></thead>
      <tbody>${r.map((rok) => radekNajmu(byt, rok, mapa)).join("")}</tbody></table>`;
  }

  function napojGrid(byt) {
    const g = $("#najem-grid");
    for (const inp of $$("input[data-mesic]", g)) {
      if (inp.dataset.napojeno) continue;
      inp.dataset.napojeno = "1";
      inp.addEventListener("change", async () => {
        const mesic = inp.dataset.mesic + "-01";
        const puvodni = data.najemne.find((n) => n.byt_id === byt.id && String(n.mesic).slice(0, 10) === mesic);
        let castka;
        try { castka = cislo(inp.value); } catch (e) { inp.classList.add("bad"); toast(e.message, true); return; }
        inp.classList.remove("bad");
        inp.classList.add("saving");
        try {
          if (castka === null) {
            if (puvodni) await uloziste.smaz("najemne", puvodni);
            data.najemne = data.najemne.filter((n) => n !== puvodni);
          } else {
            const ulozeny = await uloziste.uloz("najemne", { byt_id: byt.id, mesic, castka }, puvodni || null);
            data.najemne = [...data.najemne.filter((n) => n !== puvodni), ulozeny];
          }
          g.dataset.zmeneno = "1";
          // součet řádku
          const tr = inp.closest("tr");
          const sum = $$("input", tr).reduce((s, i) => s + (Number(String(i.value).replace(/\s/g, "").replace(",", ".")) || 0), 0);
          tr.querySelector(".sum").textContent = F.fmtKc(sum);
        } catch (e) {
          inp.classList.add("bad");
          toast(e.message, true);
        } finally {
          inp.classList.remove("saving");
        }
      });
    }
    // po opuštění gridu přepočítat ukazatele na stránce
    if (!g.dataset.napojeno) {
      g.dataset.napojeno = "1";
      g.addEventListener("focusout", (e) => {
        if (g.dataset.zmeneno && !g.contains(e.relatedTarget)) {
          const y = window.scrollY;
          vykresli();
          window.scrollTo(0, y);
        }
      });
    }
  }

  async function doplnitPodleSmluv(byt) {
    const t = F.d(dnes());
    const mapa = najemMapa(byt);
    const pron = F.pronajmyBytu(byt, data.pronajmy).filter((p) => Number(p.najem_mesic));
    if (!pron.length || !byt.porizeni_datum) return toast("Chybí smlouvy s výší nájmu.", true);
    const nove = [];
    const zac = F.d(pron[0].od);
    for (let y = zac.getUTCFullYear(), m = zac.getUTCMonth(); ; m++) {
      if (m > 11) { m = 0; y++; }
      const prvni = new Date(Date.UTC(y, m, 1));
      if (prvni > t) break;
      const k = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (mapa[k]) continue;
      const posledni = new Date(Date.UTC(y, m + 1, 0));
      // smlouva platná k 15. dni měsíce (nájem za celý měsíc)
      const stred = new Date(Date.UTC(y, m, 15));
      const p = pron.find((x) => F.d(x.od) <= stred && (!x.do || F.d(x.do) >= stred)) || pron.find((x) => F.d(x.od) <= posledni && (!x.do || F.d(x.do) >= prvni) && F.d(x.od) <= prvni);
      if (p) nove.push({ byt_id: byt.id, mesic: `${k}-01`, castka: Number(p.najem_mesic), najemce: p.najemce });
    }
    if (!nove.length) return toast("Není co doplnit – všechny měsíce se smlouvou jsou vyplněné.");
    const popis = nove.length <= 6 ? nove.map((n) => `${F.fmtMesic(n.mesic)}: ${F.fmtKc(n.castka)}`).join("\n") : `${F.fmtMesic(nove[0].mesic)} – ${F.fmtMesic(nove[nove.length - 1].mesic)}`;
    if (!confirm(`Doplnit ${nove.length} měsíců nájemného podle smluv?\n\n${popis}`)) return;
    await provest(async () => {
      for (const n of nove) await uloziste.uloz("najemne", { byt_id: n.byt_id, mesic: n.mesic, castka: n.castka }, null);
    }, `Doplněno ${nove.length} měsíců`);
  }

  // ============================================================== finance
  function vykresliFinance(main) {
    const den = dnes();
    const byty = serazeneByty();
    const p = F.portfolio(data, den);
    const v = F.vyvojHodnoty(data, den);
    const r0 = Math.min(...byty.filter((b) => b.porizeni_datum).map((b) => F.d(b.porizeni_datum).getUTCFullYear()));
    const r1 = Math.max(...byty.filter((b) => b.porizeni_datum).map((b) => F.d(b.porizeni_datum).getUTCFullYear() + 29));
    const rokyOdpisu = [];
    for (let r = r0; r <= r1; r++) rokyOdpisu.push(r);
    const letos = F.d(den).getUTCFullYear();
    const hlavaBytu = byty.map((b, i) => `<th class="num"><span class="byt-name"><span class="dot" style="background:${barvaBytu(i)}"></span>${esc(b.nazev)}</span></th>`).join("");
    const inflace = [...data.inflace].sort((a, b) => b.rok - a.rok);

    main.innerHTML = `
      <h1>Finance</h1>
      <p class="sub">Ukazatele všech bytů, vývoj hodnoty, nájemné, odpisy a inflace.</p>

      <section class="card">
        <h2>Ukazatele bytů</h2>
        <div class="scroll"><table class="tbl">
          <thead><tr><th>Byt</th>${th("Drženo", "drzeno")}${th("Pořízení", "porizeni")}${th("Hodnota", "hodnota")}${th("Zhodnocení", "zhodnoceni")}${th("Prosté p.a.", "proste")}
            ${th("CAGR", "cagr")}${th("Yield", "yield")}${th("Yield z hodnoty", "yieldHodnota")}${th("IRR", "irr")}${th("Pásmo IRR", "pasmo", false)}</tr></thead>
          <tbody>${p.souhrny.map((s) => `<tr>
            <td><a href="#/byt/${encodeURIComponent(s.byt.id)}"><b>${esc(s.byt.nazev)}</b></a></td>
            <td class="num">${s.drzeno !== null ? naVstup(s.drzeno.toFixed(1)) + " r." : "—"}</td>
            <td class="num">${F.fmtKc(s.P)}</td><td class="num">${F.fmtKc(s.V)}</td>
            <td class="num">${znamenko(s.zhodnoceni, pct(s.zhodnoceni, 1))}</td><td class="num">${pct(s.prosteZhodnoceniPa)}</td>
            <td class="num">${pct(s.cagr)}</td><td class="num">${pct(s.yield12)}</td><td class="num">${pct(s.yield12Hodnota)}</td><td class="num">${pct(s.irr)}</td>
            <td>${F.pasmo(s.irr) ? F.pasmo(s.irr).nazev : "—"}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td>Portfolio</td><td></td><td class="num">${F.fmtKc(p.P)}</td><td class="num">${F.fmtKc(p.V)}</td>
            <td class="num">${znamenko(p.zhodnoceni, pct(p.zhodnoceni, 1))}</td><td></td><td class="num" title="IRR jen z hodnoty, bez nájmů">${pct(p.irrHodnota)}</td>
            <td class="num">${pct(p.yield12)}</td><td class="num">${pct(p.yield12Hodnota)}</td><td class="num">${pct(p.irrCelkem)}</td><td>${F.pasmo(p.irrCelkem)?.nazev || ""}</td></tr></tfoot>
        </table></div>
        <p class="note">CAGR počítá s přesnou dobou mezi pořízením a posledním odhadem; u bytů držených méně než rok se nezobrazuje. V řádku Portfolio je ve sloupci CAGR IRR z hodnoty bez nájmů (obdoba listu CAGR v Excelu).</p>
      </section>

      <div class="cols">
        <section class="card">
          <h2>Pásma IRR${napoveda("irr")}</h2>
          <div class="legend">${F.PASMA.map((x) => `<div class="${F.pasmo(p.irrCelkem) === x ? "on" : ""}"><b>${x.nazev}</b><span>${x.text} <span class="muted">· ${x.typicky}</span></span></div>`).join("")}</div>
          <p class="note">Zvýrazněné pásmo = celkové IRR portfolia (${pct(p.irrCelkem)}).</p>
        </section>
        <section class="card">
          <div class="card-head"><h2>Inflace (ČSÚ)${napoveda("inflace")}</h2><button class="btn small" id="nova-inflace">+ Rok</button></div>
          <div class="scroll" style="max-height:290px;overflow-y:auto"><table class="tbl"><thead><tr><th>Rok</th><th class="num">Inflace</th><th></th></tr></thead><tbody>
            ${inflace.map((i) => `<tr><td>${i.rok}</td><td class="num">${pct(Number(i.mira), 1)}</td><td class="num"><button class="icon-btn" data-inflace="${i.rok}" title="Upravit">✎</button></td></tr>`).join("")}
          </tbody></table></div>
          ${inflace.length && inflace[0].rok < letos ? `<p class="note">Chybí inflace za ${letos} – reálný yield se za tento rok nespočítá.</p>` : ""}
        </section>
      </div>

      <section class="card" style="margin-top:20px">
        <h2>Hodnota bytů ke konci roku${napoveda("hodnotaRok")}</h2>
        <div class="scroll"><table class="tbl">
          <thead><tr><th>Rok</th>${hlavaBytu}<th class="num">Celkem</th></tr></thead>
          <tbody>${[...v.roky].reverse().map((r) => {
            const i = v.roky.indexOf(r);
            return `<tr><td><b>${r}</b></td>${v.rady.map((x) => `<td class="num">${x.hodnoty[i] ? F.fmtKc(x.hodnoty[i]) : ""}</td>`).join("")}<td class="num"><b>${F.fmtKc(v.rady.reduce((s, x) => s + x.hodnoty[i], 0))}</b></td></tr>`;
          }).join("")}</tbody>
        </table></div>
        <p class="note">Mezi pořízením a odhady lineárně dopočteno; aktuální rok = dnešní hodnota.</p>
      </section>

      <section class="card">
        <h2>Nájemné po letech</h2>
        <div class="scroll"><table class="tbl">
          <thead><tr><th>Rok</th>${hlavaBytu}<th class="num">Celkem</th></tr></thead>
          <tbody>${[...v.roky].reverse().map((r) => {
            const i = v.roky.indexOf(r);
            return `<tr><td><b>${r}</b></td>${v.rady.map((x) => `<td class="num">${x.najmy[i] ? F.fmtKc(x.najmy[i]) : ""}</td>`).join("")}<td class="num"><b>${F.fmtKc(v.rady.reduce((s, x) => s + x.najmy[i], 0))}</b></td></tr>`;
          }).join("")}</tbody>
        </table></div>
      </section>

      <section class="card">
        <h2>Daňové odpisy${napoveda("odpis")}</h2>
        <div class="scroll" style="max-height:480px;overflow-y:auto"><table class="tbl">
          <thead><tr><th>Rok</th>${hlavaBytu}<th class="num">Celkem</th></tr></thead>
          <tbody>${rokyOdpisu.map((r) => {
            const o = byty.map((b) => F.odpis(b, r));
            return `<tr${r === letos ? ' style="background:var(--soft)"' : ""}><td><b>${r}</b></td>${o.map((x) => `<td class="num">${x ? F.fmtKc(x) : ""}</td>`).join("")}<td class="num"><b>${F.fmtKc(o.reduce((s, x) => s + x, 0))}</b></td></tr>`;
          }).join("")}</tbody>
        </table></div>
        <p class="note">Rovnoměrné odpisy, odpisová skupina 5 (30 let): 1. rok (rok pořízení) 1,4 %, další roky 3,4 % ze vstupní ceny. Vstupní cena = pořizovací cena, pokud u bytu není zadaná jiná (např. bez pozemku).</p>
      </section>`;

    $("#nova-inflace").onclick = () => formular({
      titulek: "Inflace za rok", pole: POLE.inflace, hodnoty: { rok: inflace.length ? inflace[0].rok + 1 : letos },
      ulozit: (val) => uloziste.uloz("inflace", val, data.inflace.find((i) => i.rok === val.rok) || null),
    });
    $$("[data-inflace]", main).forEach((b) => (b.onclick = () => {
      const zaznam = data.inflace.find((i) => String(i.rok) === b.dataset.inflace);
      formular({ titulek: `Inflace ${zaznam.rok}`, pole: POLE.inflace, hodnoty: zaznam,
        ulozit: (val) => uloziste.uloz("inflace", val, zaznam), smazat: () => uloziste.smaz("inflace", zaznam) });
    }));
  }

  zapniNapovedu();
  start();
})();
