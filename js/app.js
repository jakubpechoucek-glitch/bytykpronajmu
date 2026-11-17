// Byty k pronájmu – aplikace (přehled, detail bytu, finance, editace).
(function () {
  "use strict";

  const F = window.Finance;
  const N = window.Najem;
  const V = window.Vyuctovani;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => (t === null || t === undefined ? "" : String(t)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const DEMO = new URLSearchParams(location.search).has("demo");

  let uloziste = null;
  let data = null;
  let grafy = [];
  let cpi = null;        // indexy/najemne-cpi.json (ČSÚ)
  let cpiChyba = null;
  let uzivatel = "";    // jméno přihlášeného (pro „kdo schválil“)

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
      uzivatel = "Ukázka";
      $("#who").innerHTML = `<span>Ukázka</span><a href="./">Ostrá data</a>`;
    } else {
      const s = await window.RodinaAuth.vyzadujPrihlaseni();
      if (!s) return;
      uloziste = window.Data.supabaseUloziste(window.RodinaAuth.client);
      uzivatel = s.jmeno || "";
      $("#who").innerHTML = `<span>${esc(s.jmeno)}</span><a href="/rozcestnik/">Rozcestník</a><button type="button" id="odhlasit">Odhlásit</button>`;
      $("#odhlasit").onclick = () => window.RodinaAuth.odhlasit();
    }
    try {
      await Promise.all([nacti(), nactiCpi()]);
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

  // Index nájmů z ČSÚ: soubor vytváří měsíční úloha na GitHubu. Chyba se neskrývá – ukáže se na stránce Nový nájem.
  async function nactiCpi() {
    try {
      const r = await fetch("indexy/najemne-cpi.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      cpi = await r.json();
      cpiChyba = null;
    } catch (e) {
      cpi = null;
      cpiChyba = e.message || String(e);
      console.error("Index nájmů z ČSÚ se nepodařilo načíst:", e);
    }
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
      const [, , cast, vid] = h.split("/");
      if (byt && cast === "vyuctovani") {
        const v = data.vyuctovani.find((x) => String(x.id) === vid);
        if (v) return vykresliListinu(main, byt, v);
      }
      if (byt) return vykresliByt(main, byt);
      main.innerHTML = `<p>Byt nenalezen. <a href="#/">Zpět na přehled</a></p>`;
    } else if (cesta === "finance") {
      vykresliFinance(main);
    } else if (cesta === "najem") {
      vykresliNajem(main, param);
    } else if (cesta === "terminy") {
      vykresliTerminy(main);
    } else {
      vykresliPrehled(main);
    }
    window.scrollTo(0, 0);
  }

  function vykresliNav(aktivni) {
    const kReseni = N.poradiPodleKonce(data, cpi, dnes()).filter((p) => p.kReseni).length;
    const odkazy = [["prehled", "#/", "Přehled"], ...serazeneByty().map((b) => [b.id, `#/byt/${encodeURIComponent(b.id)}`, b.nazev]),
      ["najem", "#/najem", kReseni ? `Nový nájem (${kReseni})` : "Nový nájem"], ["terminy", "#/terminy", "Termíny"], ["finance", "#/finance", "Finance"]];
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
  const odkazPodkladu = (u) => (u.typ === "konec-smlouvy" || u.typ === "dolozka" ? ` · <a href="#/najem/${encodeURIComponent(u.byt.id)}">podklad pro nový nájem →</a>` : "");

  function stavPronajmu(p) {
    const t = F.d(dnes());
    if (F.d(p.od) > t) return `<span class="badge mut">budoucí</span>`;
    if (!p.do || F.d(p.do) >= t) return `<span class="badge ok">běží</span>`;
    return `<span class="badge mut">skončila</span>`;
  }

  // Cesta v Dropboxu → odkaz do webového Dropboxu (náhled souboru ve složce)
  function odkazDokumentu(d) {
    if (!d) return "";
    if (/^https?:\/\//i.test(d)) return d;
    const i = d.lastIndexOf("/");
    const slozka = d.slice(0, i).split("/").map(encodeURIComponent).join("/");
    return `https://www.dropbox.com/home${slozka}?preview=${encodeURIComponent(d.slice(i + 1))}`;
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
      { k: "typ", l: "Typ dokumentu", t: "select", def: "smlouva", moznosti: [["smlouva", "Nájemní smlouva"], ["dodatek", "Dodatek (prodloužení, změna nájemného)"]] },
      { k: "najemce", l: "Nájemce", t: "text", req: true },
      { k: "kontakt", l: "Kontakt (e-mail, telefon)", t: "text" },
      { k: "od", l: "Od", t: "date", req: true },
      { k: "do", l: "Do", t: "date", help: "Prázdné = doba neurčitá" },
      { k: "inflacni_dolozka", l: "Smlouva má inflační doložku (zvýšení nájmu po prvním roce)", t: "bool", wide: true },
      { k: "zvyseni_od", l: "Zvýšení lze uplatnit od", t: "date", help: "Prázdné = první výročí začátku smlouvy. U smluv začínajících uprostřed roku ověř ve smlouvě." },
      { k: "najem_mesic", l: "Nájem / měsíc [Kč]", t: "num" },
      { k: "kauce", l: "Kauce [Kč]", t: "num" },
      { k: "zaloha_mesic", l: "Záloha na služby / měsíc [Kč]", t: "num", help: "Měsíční záloha na vodu, teplo a poplatky SVJ – podle ní se počítá vyúčtování" },
      { k: "splatnost_den", l: "Splatnost (den v měsíci)", t: "int" },
      { k: "ucet", l: "Na účet", t: "text" },
      { k: "dokument", l: "Dokument v Dropboxu", t: "text", wide: true, help: "Cesta k souboru, např. /Data z Dellu/Nemovitosti/…/smlouva.docx, nebo odkaz https://…" },
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
    navrh: [
      { k: "navrh", l: "Nové nájemné [Kč/měs.]", t: "num", req: true },
      { k: "plati_od", l: "Platí od", t: "date", req: true },
      { k: "stav", l: "Stav", t: "select", def: "navrh", moznosti: [["navrh", "Návrh (k projednání v rodině)"], ["schvaleno", "Schváleno"], ["odeslano", "Odesláno nájemníkovi"]],
        help: "Změníš-li částku schváleného návrhu, vrátí se automaticky na „Návrh“." },
      { k: "poznamka", l: "Poznámka (proč tato částka, co zaznělo při konzultaci…)", t: "area", wide: true },
    ],
    trh: [
      { k: "datum", l: "Datum údaje", t: "date", req: true },
      { k: "zdroj", l: "Zdroj", t: "select", def: "deloitte", moznosti: Object.entries(N.ZDROJE) },
      { k: "kc_m2", l: "Nájemné [Kč/m² měsíčně]", t: "num", req: true },
      { k: "poznamka", l: "Poznámka", t: "text", wide: true },
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
    if (p.t === "nadpis") return `<h3 class="f-nadpis">${p.l}</h3>`;
    let input;
    if (p.t === "select") input = `<select id="${id}" name="${p.k}">${p.moznosti.map(([h, t]) => `<option value="${esc(h)}" ${String(val) === h ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    else if (p.t === "area") input = `<textarea id="${id}" name="${p.k}">${esc(val)}</textarea>`;
    else if (p.t === "bool") return `<div class="f ${p.wide ? "wide" : ""}"><label class="check"><input type="checkbox" id="${id}" name="${p.k}" ${val ? "checked" : ""}> ${p.l}</label></div>`;
    else if (p.t === "date") input = `<input type="date" id="${id}" name="${p.k}" value="${esc(val ? String(val).slice(0, 10) : "")}" ${p.req ? "required" : ""}>`;
    else if (p.t === "url") input = `<input type="url" id="${id}" name="${p.k}" value="${esc(val)}" placeholder="https://…">`;
    else if (p.t === "pct") input = `<input type="text" inputmode="decimal" id="${id}" name="${p.k}" value="${val === "" ? "" : esc(naVstup(+(Number(val) * 100).toFixed(4)))}" ${p.req ? "required" : ""}>`;
    else if (p.t === "num" || p.t === "int") input = `<input type="text" inputmode="${p.t === "int" ? "numeric" : "decimal"}" id="${id}" name="${p.k}" value="${esc(naVstup(val))}" ${p.req ? "required" : ""}>`;
    else input = `<input type="text" id="${id}" name="${p.k}" value="${esc(val)}" ${p.req ? "required" : ""}>`;
    return `<div class="f ${p.wide ? "wide" : ""}"><label for="${id}">${p.l}${p.req ? " *" : ""}</label>${input}${p.help ? `<span class="hint">${p.help}</span>` : ""}</div>`;
  }

  function hodnotyFormulare(pole_, form) {
    const out = {};
    for (const p of pole_) {
      if (p.t === "nadpis") continue;
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
    dlg.classList.remove("siroky");
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
    const prvni = form.querySelector("input, textarea, select");
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
    const upoz = F.upozorneni(data, den).concat(N.upozorneniDolozky(data, cpi, den));
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
        ${upoz.map((u) => `<li class="${u.uroven}"><span><a href="#/byt/${encodeURIComponent(u.byt.id)}">${esc(u.byt.nazev)}</a> – ${esc(u.text)}${odkazPodkladu(u)}</span></li>`).join("")}
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
    const upoz = F.upozorneni({ ...data, byty: [byt] }, den).concat(N.upozorneniDolozky({ ...data, byty: [byt] }, cpi, den));
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

      ${upoz.length ? `<section class="card"><h2>Upozornění</h2><ul class="alerts">${upoz.map((u) => `<li class="${u.uroven}"><span>${esc(u.text)}${odkazPodkladu(u)}</span></li>`).join("")}</ul></section>` : ""}

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
        <div class="card-head"><h2>Pronájmy</h2><div class="actions"><a class="btn small" href="#/najem/${encodeURIComponent(byt.id)}">Podklad pro nový nájem</a><button class="btn small" id="novy-pronajem">+ Nová smlouva</button></div></div>
        ${pron.length ? `<div class="scroll"><table class="tbl pron">
          <thead><tr><th>#</th><th>Nájemce / dokument</th><th>Od</th><th>Do</th><th></th><th class="num">Nájem</th><th class="num">Kauce</th><th class="num">Záloha</th><th class="num">Splatnost</th><th>Účet</th><th>Kontakt</th><th></th></tr></thead>
          ${(() => {
            // seskupit navazující záznamy téhož nájemce; rozbalený jen poslední
            const skupiny = [];
            pron.forEach((p, i) => { if (i === 0 || pron[i - 1].najemce !== p.najemce) skupiny.push([]); skupiny[skupiny.length - 1].push(p); });
            return skupiny.map((g, si) => {
              const prvni = g[0], posl = g[g.length - 1], otevrena = si === skupiny.length - 1;
              const kontakt = g.map((p) => p.kontakt).find(Boolean);
              const souhrn = { ...posl, od: prvni.od };
              const hlava = `<tr class="najemce-hlava" tabindex="0" aria-expanded="${otevrena}">
                <td class="muted">${si + 1}.</td>
                <td><span class="sipka">▸</span> <b>${esc(prvni.najemce)}</b> <span class="muted" style="font-size:.8rem">· ${g.length} ${g.length === 1 ? "dokument" : g.length < 5 ? "dokumenty" : "dokumentů"}</span></td>
                <td>${F.fmtDatum(prvni.od)}</td><td>${posl.do ? F.fmtDatum(posl.do) : "neurčito"}</td><td>${stavPronajmu(souhrn)}</td>
                <td class="num">${F.fmtKc(posl.najem_mesic)}</td><td class="num">${F.fmtKc(posl.kauce)}</td><td class="num">${posl.zaloha_mesic ? F.fmtKc(posl.zaloha_mesic) : "—"}</td>
                <td class="num">${posl.splatnost_den ? `do ${posl.splatnost_den}.` : "—"}</td><td>${esc(posl.ucet)}</td>
                <td>${kontakt ? (kontakt.includes("@") ? `<a href="mailto:${esc(kontakt)}">${esc(kontakt)}</a>` : esc(kontakt)) : ""}</td><td></td>
              </tr>`;
              const radky = g.map((p) => {
                const doc = odkazDokumentu(p.dokument);
                const typ = p.typ === "dodatek" ? `<span class="badge mut">dodatek</span>` : `<span class="badge">smlouva</span>`;
                return `<tr class="dokument">
                  <td></td><td>${typ}${doc ? ` <a href="${esc(doc)}" target="_blank" rel="noopener" title="${esc(p.dokument)}">📄</a>` : ""}${p.poznamka ? `<div class="muted" style="font-size:.8rem">${esc(p.poznamka)}</div>` : ""}</td>
                  <td>${F.fmtDatum(p.od)}</td><td>${p.do ? F.fmtDatum(p.do) : "neurčito"}</td><td>${stavPronajmu(p)}</td>
                  <td class="num">${F.fmtKc(p.najem_mesic)}</td><td class="num">${F.fmtKc(p.kauce)}</td><td class="num">${p.zaloha_mesic ? F.fmtKc(p.zaloha_mesic) : "—"}</td>
                  <td class="num">${p.splatnost_den ? `do ${p.splatnost_den}.` : "—"}</td><td>${esc(p.ucet)}</td><td></td>
                  <td><button class="icon-btn" data-pronajem="${p.id}" title="Upravit">✎</button></td>
                </tr>`;
              }).join("");
              return `<tbody class="skupina${otevrena ? " otevrena" : ""}">${hlava}${radky}</tbody>`;
            }).join("");
          })()}</table></div>
          <p class="note">Kliknutím na nájemce rozbalíte jeho smlouvy a dodatky. 📄 otevře dokument v Dropboxu.</p>` : `<p class="muted">Zatím žádná smlouva.</p>`}
      </section>

      ${sekceVyuctovani(byt)}

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
        posl ? { typ: "smlouva", najemce: posl.najemce, kontakt: posl.kontakt, od: posl.do ? F.iso(new Date(F.d(posl.do).getTime() + 864e5)) : null,
                 najem_mesic: posl.najem_mesic, kauce: posl.kauce, splatnost_den: posl.splatnost_den, ucet: posl.ucet } : { typ: "smlouva" });
    };
    $$("tr.najemce-hlava", main).forEach((tr) => {
      const prepni = (e) => {
        if (e.target.closest("a, button")) return;
        tr.setAttribute("aria-expanded", tr.parentElement.classList.toggle("otevrena"));
      };
      tr.onclick = prepni;
      tr.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); prepni(e); } };
    });
    $$("[data-pronajem]", main).forEach((b) => (b.onclick = () => upravitZaznam("pronajmy", "pronajem", "Upravit smlouvu", byt, pron.find((p) => String(p.id) === b.dataset.pronajem))));
    $("#nove-vyuct").onclick = () => upravitVyuctovani(byt, null);
    $$("[data-vyuct]", main).forEach((b) => (b.onclick = () => upravitVyuctovani(byt, data.vyuctovani.find((x) => String(x.id) === b.dataset.vyuct))));
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

  // ============================================================== nový nájem
  const ODKAZ_DELOITTE = "https://www.deloitte.com/cz-sk/cs/about/press-room.html";
  const ODKAZ_MF = "https://mf.gov.cz/cs/rozpoctova-politika/podpora-projektoveho-rizeni/cenova-mapa/kalkulacka-trzniho-najemneho";
  const STAV_NAVRHU = { navrh: ["návrh", "warn"], schvaleno: ["schváleno", "ok"], odeslano: ["odesláno nájemníkovi", "mut"] };
  const dnyTxt = (n) => (n === 0 ? "dnes" : `za ${n} ${n === 1 ? "den" : n < 5 ? "dny" : "dní"}`);

  function stavSmlouvy(p) {
    const a = p.akt;
    if (!a) return `<span class="badge err">bez smlouvy</span>`;
    if (!a.beziSmlouva) return `<span class="badge err">smlouva skončila ${F.fmtDatum(a.do)}</span>`;
    if (!a.do) return `<span class="badge ok">doba neurčitá</span>`;
    if (p.kReseni) return `<span class="badge warn">končí ${F.fmtDatum(a.do)} · ${dnyTxt(a.dnuDoKonce)}</span>`;
    return `<span class="badge ok">běží do ${F.fmtDatum(a.do)} · ${dnyTxt(a.dnuDoKonce)}</span>`;
  }

  // Stav zdrojů dat nahoře na stránce: nic nesmí selhat potichu
  function zdrojeDat(den) {
    const out = [];
    if (data._chybiTabulky && data._chybiTabulky.length) {
      out.push(["chyba", `V databázi chybí tabulky ${esc(data._chybiTabulky.join(", "))}. Spusť znovu <code>supabase/schema.sql</code> (viz docs/08-nastaveni-supabase.md), jinak se tržní data a návrhy neuloží.`]);
    }
    const idx = N.posledniIndex(cpi);
    const sc = N.stavCpi(cpi, den);
    if (cpiChyba || !idx) {
      out.push(["chyba", `Inflace nájmů z ČSÚ se nenačetla${cpiChyba ? ` (${esc(cpiChyba)})` : ""}. Varianta „inflace“ se proto nepočítá.`]);
    } else {
      out.push([sc.ok ? "info" : "varovani", `Inflace nájmů (ČSÚ): <b>${F.fmtPct(idx.koef - 1, 1)}</b> meziročně za ${F.fmtMesic(idx.mesic + "-01")} · ${esc(sc.text)}`]);
    }
    const tt = N.terminyTrhu(data.najem_trh, den);
    const dni = (n) => `${n} ${n === 1 ? "den" : n < 5 ? "dny" : "dní"}`;
    const naposled = tt.poslZapis ? `naposledy zapsána ${F.fmtDatum(tt.poslZapis)}` : "zatím nezapsána";
    if (tt.splatne) {
      out.push(["varovani", `<b>Čtvrtletní tržní data (Deloitte, MF) je čas zapsat</b> – termín byl ${F.fmtDatum(tt.posledni)}, ${naposled}. Zapiš je tlačítkem „Zapsat čtvrtletní data“.`]);
    } else {
      out.push(["info", `Čtvrtletní tržní data (Deloitte, MF): ${naposled} · další zápis do <b>${F.fmtDatum(tt.dalsi)}</b> (za ${dni(tt.dniDoDalsiho)}). Ministerstvo financí cenovou mapu zveřejňuje do 45 dnů po konci čtvrtletí.`]);
    }
    return `<section class="card"><h2>Zdroje dat</h2><ul class="alerts">${out.map(([u, t]) => `<li class="${u}"><span>${t}</span></li>`).join("")}</ul></section>`;
  }

  // Odeslaný návrh, jehož datum už nastalo, je historie – nový nájem začíná novým návrhem
  const jeVyrizeny = (n, den) => !!n && n.stav === "odeslano" && F.d(n.plati_od) <= F.d(den);

  // Inflační doložka: kdy lze nájem zvýšit a do kdy to odeslat
  function blokDolozky(p) {
    const d = p.dolozka;
    if (!d) return "";
    const stav = d.vyreseno ? `<span class="badge ok">vyřešeno</span>`
      : d.poTerminu ? `<span class="badge err">termín odeslání uplynul</span>`
      : d.kReseni ? `<span class="badge warn">k řešení</span>` : `<span class="badge mut">zatím nehlídá</span>`;
    const kdy = d.uzJe ? "už lze" : `lze za ${d.dniDoDatumu} ${d.dniDoDatumu === 1 ? "den" : d.dniDoDatumu < 5 ? "dny" : "dní"}`;
    const idx = N.posledniIndex(cpi), obe = N.posledniObecna(cpi);
    const rozdilIdx = idx && obe && idx.koef - obe.koef > 0.01;
    return `<div class="dolozka">
      <div><b>Inflační doložka</b> ${stav}</div>
      <div>Nájem ${kdy} zvýšit <b>od ${F.fmtDatum(d.datum)}</b>. Začít řešit od ${F.fmtDatum(d.zacit)}, oznámení / dodatek odeslat do <b>${F.fmtDatum(d.odeslat)}</b>.</div>
      <p class="note">Změna se dělá dodatkem podepsaným oběma stranami. Smlouva lhůtu pro oznámení neurčuje, termíny jsou vnitřní pravidlo aplikace (${3} a ${2} měsíce předem).
      ${rozdilIdx ? `Doložka mluví o <b>inflaci vyhlášené ČSÚ nebo ČNB</b>, tedy o obecné inflaci (${F.fmtPct(obe.koef - 1, 1)}), ne o inflaci nájmů (${F.fmtPct(idx.koef - 1, 1)}). Zvýšení podle nájmů vychází výš – zvaž, zda to znění doložky unese.` : ""}</p>
    </div>`;
  }

  function kartaNajmu(p, den) {
    const { byt, akt } = p;
    const n = jeVyrizeny(p.navrh, den) ? null : p.navrh;
    const m2 = F.num(byt.plocha_m2);
    const radky = [];
    if (akt && akt.najem) {
      radky.push(`<tr class="nynejsi"><td>Nynější nájem${akt.najemce ? ` <span class="muted">(${esc(akt.najemce)})</span>` : ""}</td>
        <td class="num hide-m">${akt.kcM2 ? F.fmtKc(akt.kcM2) : "—"}</td><td class="num"><b>${F.fmtKc(akt.najem)}</b></td><td class="num">—</td></tr>`);
    }
    for (const v of p.varianty) {
      radky.push(`<tr>
        <td>${esc(v.nazev)}${v.datum ? `<div class="radek-info"><span class="muted">údaj z ${F.fmtDatum(v.datum)}</span>${v.stare ? ` <span class="badge warn">zastaralé</span>` : ""}${v.id ? ` <button class="icon-btn" data-trh="${v.id}" title="Upravit údaj" aria-label="Upravit údaj">✎</button>` : ""}</div>` : ""}</td>
        <td class="num hide-m">${v.kcM2 ? F.fmtKc(v.kcM2) : "—"}</td>
        <td class="num"><b>${F.fmtKc(v.castka)}</b></td>
        <td class="num">${v.rozdil === null ? "—" : znamenko(v.rozdil, pct(v.rozdil, 1))}</td>
      </tr>`);
    }
    if (n) {
      const [stavTxt, stavTrida] = STAV_NAVRHU[n.stav] || [n.stav, "mut"];
      radky.push(`<tr class="navrh-row"><td><b>Tvůj návrh</b> <span class="badge ${stavTrida}">${stavTxt}</span><div class="radek-info"><span class="muted">platí od ${F.fmtDatum(n.plati_od)}</span></div></td>
        <td class="num hide-m">${p.navrhKcM2 ? F.fmtKc(p.navrhKcM2) : "—"}</td><td class="num"><b>${F.fmtKc(n.navrh)}</b></td>
        <td class="num">${p.navrhRozdil === null ? "—" : znamenko(p.navrhRozdil, pct(p.navrhRozdil, 1))}</td></tr>`);
    }

    const razitka = n ? [
      n.upravil ? `upravil ${esc(n.upravil)}${n.upraveno ? ` (${F.fmtDatum(n.upraveno)})` : ""}` : "",
      n.schvalil ? `schválil ${esc(n.schvalil)}${n.schvaleno ? ` (${F.fmtDatum(n.schvaleno)})` : ""}` : "",
    ].filter(Boolean).join(" · ") : "";
    const historie = p.navrh && !n ? `<p class="note">Poslední návrh: ${F.fmtKc(p.navrh.navrh)} od ${F.fmtDatum(p.navrh.plati_od)} (odesláno).</p>` : "";

    const akce = !akt ? "" : n
      ? `<button class="btn small" data-navrh="${esc(byt.id)}">Upravit návrh</button>
         ${n.stav === "navrh" ? `<button class="btn primary small" data-stav="schvaleno" data-byt="${esc(byt.id)}">Schválit</button>` : ""}
         ${n.stav === "schvaleno" ? `<button class="btn primary small" data-stav="odeslano" data-byt="${esc(byt.id)}">Označit jako odesláno nájemníkovi</button>` : ""}
         ${n.stav !== "navrh" ? `<button class="btn small" data-stav="navrh" data-byt="${esc(byt.id)}">Vrátit k návrhu</button>` : ""}`
      : `<button class="btn primary small" data-navrh="${esc(byt.id)}">Zapsat návrh</button>`;

    return `<section class="card najem-card ${p.kReseni ? "k-reseni" : ""}" id="najem-${esc(byt.id)}">
      <div class="card-head">
        <div><h2><a href="#/najem/${encodeURIComponent(byt.id)}">${esc(byt.nazev)}</a></h2>
          <div class="sub">${[esc(byt.dispozice), m2 ? `${naVstup(m2)} m²` : "", akt && akt.najemce && akt.do ? `smlouva do ${F.fmtDatum(akt.do)}` : ""].filter(Boolean).join(" · ")}</div></div>
        <div>${stavSmlouvy(p)}</div>
      </div>
      ${akt && akt.najem ? `<div class="scroll"><table class="tbl var-table">
        <thead><tr><th>Varianta</th><th class="num hide-m">Kč/m²</th><th class="num">Nájem / měs.</th><th class="num">Změna</th></tr></thead>
        <tbody>${radky.join("")}</tbody></table></div>
        ${p.varianty.some((v) => v.klic !== "inflace") ? "" : `<p class="note">Zatím chybí tržní údaje pro tento byt – zapiš je tlačítkem „Zapsat čtvrtletní data“ nahoře.</p>`}
        ${!m2 ? `<p class="note err-text">U bytu chybí plocha, tržní varianty se bez ní nespočítají.</p>` : ""}`
        : `<p class="muted">${akt ? "Ve smlouvě chybí výše nájmu." : "U bytu není žádná smlouva, podklad nejde spočítat."}</p>`}
      ${blokDolozky(p)}
      ${n && n.poznamka ? `<p class="navrh-poznamka">${esc(n.poznamka)}</p>` : ""}
      ${razitka ? `<p class="note">${razitka}</p>` : ""}
      ${historie}
      ${akce ? `<div class="actions navrh-akce">${akce}</div>` : ""}
    </section>`;
  }

  function vykresliNajem(main, param) {
    const den = dnes();
    const jedenId = param ? decodeURIComponent(param) : null;
    let polozky = N.poradiPodleKonce(data, cpi, den);
    if (jedenId) polozky = polozky.filter((p) => p.byt.id === jedenId);
    const porovnatSe = Object.fromEntries(polozky.map((p) => [p.byt.id, p]));

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Nový nájem</h1>
          <p class="sub">Podklad pro prodloužení smluv: inflace nájmů, tržní nájemné a tvůj návrh. ${jedenId ? `<a href="#/najem">← všechny byty</a>` : "Byty jsou seřazené podle konce smlouvy."}</p>
        </div>
        <button class="btn" id="trh-zapsat">Zapsat čtvrtletní data</button>
      </div>
      ${zdrojeDat(den)}
      ${polozky.length ? polozky.map((p) => kartaNajmu(p, den)).join("") : `<p class="muted">Byt nenalezen. <a href="#/najem">Zpět na všechny byty</a></p>`}
      <p class="note">Varianta „inflace“ = nynější nájem × meziroční index cen nájemného za bydlení (ČSÚ). Tržní varianty = Kč/m² ze zdroje × plocha bytu.
      Zdroje jsou orientační – rozhodnutí je na vás.</p>`;

    $("#trh-zapsat").onclick = zapsatTrh;
    $$("[data-navrh]", main).forEach((b) => (b.onclick = () => upravitNavrh(porovnatSe[b.dataset.navrh], den)));
    $$("[data-stav]", main).forEach((b) => (b.onclick = () => zmenStavNavrhu(porovnatSe[b.dataset.byt].navrh, b.dataset.stav)));
    $$("[data-trh]", main).forEach((b) => (b.onclick = () => {
      const r = data.najem_trh.find((x) => String(x.id) === b.dataset.trh);
      const byt = data.byty.find((x) => x.id === r.byt_id);
      upravitZaznam("najem_trh", "trh", `Tržní údaj: ${byt.nazev}`, byt, r);
    }));
  }

  // Všechny hlídané termíny na jedné ose
  function vykresliTerminy(main) {
    const den = dnes();
    const tm = N.terminy(data, cpi, den);
    const ZNACKA = { konec: "mut", "dolozka-zacit": "mut", "dolozka-odeslat": "warn", dolozka: "mut", fixace: "mut", trh: "mut" };
    const kdy = (x) => (x.dni < 0 ? `před ${-x.dni} dny` : x.dni === 0 ? "dnes" : `za ${x.dni} ${x.dni === 1 ? "den" : x.dni < 5 ? "dny" : "dní"}`);
    main.innerHTML = `
      <div class="page-head"><div><h1>Termíny</h1>
        <p class="sub">Konec smluv, zvýšení nájmu podle inflační doložky, konec fixace hypotéky a čtvrtletní tržní data. Vyřešené termíny se skrývají.</p></div></div>
      <section class="card">
        ${tm.length ? `<div class="scroll"><table class="tbl terminy">
          <thead><tr><th>Kdy</th><th>Byt</th><th>Co</th></tr></thead>
          <tbody>${tm.map((x) => `<tr class="${x.dni < 0 ? "po-terminu" : x.dni <= 30 ? "blizko" : ""}">
            <td class="nowrap"><b>${F.fmtDatum(x.datum)}</b><div class="radek-info ${x.dni < 0 ? "neg" : "muted"}">${kdy(x)}</div></td>
            <td>${x.byt ? `<a href="#/byt/${encodeURIComponent(x.byt.id)}">${esc(x.byt.nazev)}</a>` : `<span class="muted">všechny</span>`}</td>
            <td>${esc(x.text)}${x.odkaz ? `<div class="radek-info"><a href="${x.odkaz}">${x.typ === "trh" ? "Zapsat data →" : "Podklad →"}</a></div>` : ""}</td></tr>`).join("")}</tbody>
        </table></div>` : `<p class="muted">Žádné blížící se termíny.</p>`}
        <p class="note">Doložka z čl. 4.5 nájemních smluv: nájem je pevný první rok, po každém dalším roce lze zvýšit o inflaci. Termíny „začít řešit“ (3 měsíce předem) a „odeslat“ (2 měsíce předem) jsou vnitřní pravidlo aplikace.</p>
      </section>`;
  }

  // Kdo a kdy naposledy měnil návrh, kdo ho schválil
  function razitko(stav, puvodni) {
    const ted = new Date().toISOString();
    const out = { upravil: uzivatel, upraveno: ted };
    if (stav === "navrh") { out.schvalil = null; out.schvaleno = null; }
    else if (!puvodni || puvodni.stav === "navrh" || !puvodni.schvalil) { out.schvalil = uzivatel; out.schvaleno = ted; }
    return out;
  }

  function upravitNavrh(p, den) {
    const n = jeVyrizeny(p.navrh, den) ? null : p.navrh;
    const infl = p.varianty.find((v) => v.klic === "inflace");
    const vychozi = n || {
      navrh: infl ? Math.round(infl.castka / 100) * 100 : null,
      plati_od: p.akt && p.akt.do ? F.iso(new Date(F.d(p.akt.do).getTime() + 864e5)) : null,
      stav: "navrh",
    };
    formular({
      titulek: `Návrh nového nájemného: ${p.byt.nazev}`,
      pole: POLE.navrh,
      hodnoty: vychozi,
      ulozit: (v) => {
        let stav = v.stav;
        // změna částky nebo data u schváleného návrhu = je potřeba nové schválení
        if (n && n.stav === "schvaleno" && stav === "schvaleno" &&
            (Number(v.navrh) !== Number(n.navrh) || String(v.plati_od) !== String(n.plati_od).slice(0, 10))) stav = "navrh";
        return uloziste.uloz("najem_navrhy", { ...v, stav, byt_id: p.byt.id, ...razitko(stav, n) }, n);
      },
      smazat: n ? () => uloziste.smaz("najem_navrhy", n) : null,
    });
  }

  function zmenStavNavrhu(n, stav) {
    const hlaska = { schvaleno: "Schváleno", odeslano: "Označeno jako odesláno", navrh: "Vráceno k návrhu" }[stav];
    return provest(() => uloziste.uloz("najem_navrhy", { ...n, stav, ...razitko(stav, n) }, n), hlaska).catch(() => {});
  }

  // Jeden formulář pro tržní údaje všech bytů najednou (jednou za čtvrtletí)
  function zapsatTrh() {
    const byty = serazeneByty().filter((b) => F.num(b.plocha_m2));
    if (!byty.length) return toast("Nejdřív doplň plochu bytů.", true);
    const naposled = (b, z) => {
      const r = N.poslednTrh(data.najem_trh || [], b.id)[z];
      return r ? `naposled ${naVstup(Number(r.kc_m2))} Kč/m² (${F.fmtDatum(r.datum)})` : "zatím nezapsáno";
    };
    const polea = [{
      k: "datum", l: "Údaje platí k", t: "date", req: true, def: dnes(), wide: true,
      help: `Otevři <a href="${ODKAZ_DELOITTE}" target="_blank" rel="noopener">Deloitte Rent Index</a> (nejnovější zpráva, nájem v Kč/m² podle městské části) a
        <a href="${ODKAZ_MF}" target="_blank" rel="noopener">kalkulačku MF</a> (adresa a parametry bytu). Co nevyplníš, zůstane beze změny. Zapisuje se jednou za čtvrtletí, do 20. února, května, srpna a listopadu.`,
    }];
    for (const b of byty) {
      polea.push({ k: `h_${b.id}`, l: `${esc(b.nazev)} · ${naVstup(Number(b.plocha_m2))} m²`, t: "nadpis" });
      polea.push({ k: `d_${b.id}`, l: "Deloitte [Kč/m²]", t: "num", help: naposled(b, "deloitte") });
      polea.push({ k: `m_${b.id}`, l: "Ministerstvo financí [Kč/m²]", t: "num", help: naposled(b, "mf") });
    }
    formular({
      titulek: "Čtvrtletní tržní data",
      pole: polea,
      ulozit: async (v) => {
        const radky = [];
        for (const b of byty) {
          if (v[`d_${b.id}`] !== null) radky.push({ byt_id: b.id, datum: v.datum, zdroj: "deloitte", kc_m2: v[`d_${b.id}`] });
          if (v[`m_${b.id}`] !== null) radky.push({ byt_id: b.id, datum: v.datum, zdroj: "mf", kc_m2: v[`m_${b.id}`] });
        }
        if (!radky.length) throw new Error("Nic nevyplněno – zadej aspoň jedno číslo.");
        for (const r of radky) await uloziste.uloz("najem_trh", r, null);
      },
    });
  }

  // ============================================================== vyúčtování záloh
  const kc2 = (v) => (v === null || v === undefined || isNaN(v) ? "—" : Number(v).toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, " ") + " Kč");
  const cisloMeke = (x) => { try { return cislo(x ?? ""); } catch (e) { return null; } };
  const mn = (x) => (x === null || x === undefined || x === "" ? "" : String(x).replace(".", ","));
  const vysledekText = (r) => (r.preplatek ? "Přeplatek" : r.nedoplatek ? "Nedoplatek" : "Vyrovnáno");

  function sekceVyuctovani(byt) {
    const seznam = data.vyuctovani.filter((v) => v.byt_id === byt.id).sort((a, b) => b.rok - a.rok || (a.od < b.od ? 1 : -1));
    const chybi = (data._chybiTabulky || []).includes("vyuctovani");
    return `<section class="card" id="vyuctovani">
      <div class="card-head"><h2>Vyúčtování záloh</h2><button class="btn small" id="nove-vyuct" ${chybi ? "disabled" : ""}>+ Nové vyúčtování</button></div>
      ${chybi ? `<p class="err">V databázi chybí tabulka <code>vyuctovani</code>. Spusť znovu <code>supabase/schema.sql</code> v Supabase (SQL Editor).</p>` : ""}
      ${seznam.length ? `<div class="scroll"><table class="tbl">
        <thead><tr><th>Rok</th><th>Nájemce</th><th class="num">Náklady</th><th class="num">Zálohy</th><th class="num">Výsledek</th><th>Odesláno</th><th></th></tr></thead>
        <tbody>${seznam.map((v) => {
          const r = V.vypocet(v);
          const badge = r.preplatek ? `<span class="badge ok">přeplatek</span>` : r.nedoplatek ? `<span class="badge err">nedoplatek</span>` : `<span class="badge mut">vyrovnáno</span>`;
          return `<tr>
            <td><b>${v.rok}</b>${F.fmtDatum(v.od) !== `1. 1. ${v.rok}` || F.fmtDatum(v.do) !== `31. 12. ${v.rok}` ? `<div class="muted" style="font-size:.78rem">${F.fmtDatum(v.od)} – ${F.fmtDatum(v.do)}</div>` : ""}</td>
            <td>${esc(v.najemce)}</td>
            <td class="num">${kc2(r.celkem)}</td><td class="num">${kc2(r.zalohy)}</td>
            <td class="num">${badge} <span class="${r.preplatek ? "pos" : r.nedoplatek ? "neg" : ""}">${kc2(Math.abs(r.rozdil))}</span>${r.maVyrovnani ? `<div class="muted" style="font-size:.78rem">po vyrovnání kauce: ${r.kVraceni >= 0 ? "vrátit" : "doplatit"} ${kc2(Math.abs(r.kVraceni))}</div>` : ""}</td>
            <td>${v.odeslano ? F.fmtDatum(v.odeslano) : `<span class="badge warn">neodesláno</span>`}</td>
            <td class="num nowrap"><a class="btn small" href="#/byt/${encodeURIComponent(byt.id)}/vyuctovani/${v.id}">Tisk / PDF</a> <button class="icon-btn" data-vyuct="${v.id}" title="Upravit">✎</button></td>
          </tr>`;
        }).join("")}</tbody></table></div>
        <p class="note">Přeplatek se vrací nájemníkovi, nedoplatek doplácí. „Tisk / PDF“ otevře čistou listinu pro nájemníka (v tiskovém dialogu zvol Uložit jako PDF).</p>`
      : `<p class="muted">Zatím žádné vyúčtování. Při prvním se předvyplní zálohy ze smlouvy a typické položky.</p>`}
    </section>`;
  }

  // ---- listina k tisku (čistá stránka pro nájemníka)
  function vykresliListinu(main, byt, v) {
    const r = V.vypocet(v);
    const radek = (p) => {
      let popis = "";
      if (p.typ === "meridlo") popis = `${mn(p.stav_od)} → ${mn(p.stav_do)} ${esc(p.jednotka || "")} · spotřeba ${mn(V.spotreba(p))} ${esc(p.jednotka || "")} × ${kc2(Number(p.cena))}`;
      else if (p.typ === "den") popis = `${kc2(Number(p.cena))} × ${mn(p.dny)} dní`;
      return `<tr><td>${esc(p.nazev)}${popis ? `<div class="muted drobne">${popis}</div>` : ""}</td><td class="num">${kc2(p.naklad)}</td></tr>`;
    };
    const radky = r.nakladPol.map(radek).join("");
    const nazevRadku = r.preplatek ? "Přeplatek – bude vrácen nájemci" : r.nedoplatek ? "Nedoplatek – k úhradě nájemcem" : "Vyúčtování je vyrovnané";
    main.innerHTML = `
      <div class="noprint listina-akce">
        <a class="btn" href="#/byt/${encodeURIComponent(byt.id)}">← ${esc(byt.nazev)}</a>
        <button class="btn primary" id="tisk">Vytisknout / uložit PDF</button>
      </div>
      <article class="listina">
        <h1>Vyúčtování záloh za služby spojené s využíváním bytu</h1>
        <dl class="info listina-hlava">
          <dt>Byt</dt><dd>${esc(byt.nazev)}${byt.adresa ? `, ${esc(byt.adresa)}` : ""}${byt.dispozice ? ` (${esc(byt.dispozice)})` : ""}</dd>
          <dt>Nájemce</dt><dd>${esc(v.najemce) || "—"}</dd>
          <dt>Období</dt><dd>${F.fmtDatum(v.od)} – ${F.fmtDatum(v.do)}</dd>
        </dl>
        <table class="tbl listina-tbl">
          <thead><tr><th>Položka</th><th class="num">Částka</th></tr></thead>
          <tbody>${radky}</tbody>
          <tfoot>
            ${r.odpocty ? `<tr><td>Náklady před odečty</td><td class="num">${kc2(r.naklady)}</td></tr>` : ""}
            <tr><td>Náklady celkem</td><td class="num">${kc2(r.celkem)}</td></tr>
            <tr><td>Zaplacené zálohy${v.zalohy_celkem === null || v.zalohy_celkem === undefined || v.zalohy_celkem === "" ? ` (${mn(v.mesicu)} × ${kc2(Number(v.zaloha_mesic))})` : ""}</td><td class="num">${kc2(r.zalohy)}</td></tr>
            <tr class="vysledek ${r.preplatek ? "pos" : r.nedoplatek ? "neg" : ""}"><td>${nazevRadku}</td><td class="num">${kc2(Math.abs(r.rozdil))}</td></tr>
          </tfoot>
        </table>
        ${r.maVyrovnani ? `<h2 class="listina-h2">Vyrovnání při ukončení nájmu</h2>
        <table class="tbl listina-tbl"><tbody>
          <tr><td>${r.preplatek ? "Přeplatek ze služeb" : "Nedoplatek ze služeb"}</td><td class="num">${kc2(r.rozdil)}</td></tr>
          ${r.vyrovnaniPol.map(radek).join("")}
        </tbody><tfoot><tr class="vysledek ${r.kVraceni >= 0 ? "pos" : "neg"}"><td>${r.kVraceni >= 0 ? "Celkem k vrácení nájemci" : "Celkem doplatí nájemce"}</td><td class="num">${kc2(Math.abs(r.kVraceni))}</td></tr></tfoot></table>` : ""}
        ${v.poznamka ? `<p class="drobne">${esc(v.poznamka)}</p>` : ""}
      </article>`;
    $("#tisk").onclick = () => window.print();
  }

  // ---- editor vyúčtování (vlastní dialog s položkami)
  const TYPY_POLOZEK = Object.entries(V.TYPY);
  const NOVA_POLOZKA = {
    meridlo: { typ: "meridlo", nazev: "", jednotka: "m³", stav_od: "", stav_do: "", spotreba: "", cena: "" },
    den: { typ: "den", nazev: "", cena: "", dny: "" },
    castka: { typ: "castka", nazev: "", castka: "" },
    odpocet: { typ: "odpocet", nazev: "Fond oprav", castka: "" },
    kauce: { typ: "kauce", nazev: "Kauce včetně úroků", castka: "" },
    srazka: { typ: "srazka", nazev: "", castka: "" },
  };

  function vychoziPolozky(byt, od, dny) {
    // z předchozího vyúčtování: koncové stavy měřičů se stanou počátečními, ceny a odečty zůstanou k přepsání
    const predchozi = data.vyuctovani.filter((x) => x.byt_id === byt.id && x.do < od).sort((a, b) => (a.do < b.do ? 1 : -1))[0];
    if (predchozi) {
      return (predchozi.polozky || []).filter((p) => p.typ !== "kauce" && p.typ !== "srazka").map((p) => {
        const k = { ...NOVA_POLOZKA[p.typ], ...p };
        if (p.typ === "meridlo") { k.stav_od = p.stav_do ?? ""; k.stav_do = ""; k.spotreba = ""; }
        if (p.typ === "den") k.dny = dny;
        if (p.typ === "castka" || p.typ === "odpocet") k.castka = "";
        if (p.naklad_rucne !== undefined) k.naklad_rucne = "";
        return k;
      });
    }
    return [
      { ...NOVA_POLOZKA.meridlo, nazev: "Teplá voda" },
      { ...NOVA_POLOZKA.meridlo, nazev: "Studená voda" },
      { ...NOVA_POLOZKA.meridlo, nazev: "Teplo", jednotka: "GJ" },
      { ...NOVA_POLOZKA.castka, nazev: "Ostatní náklady (podle vyúčtování SVJ)" },
      { ...NOVA_POLOZKA.odpocet },
    ];
  }

  function upravitVyuctovani(byt, zaznam) {
    const dlg = $("#dlg"), form = $("#dlg-form"), err = $("#dlg-err"), del = $("#dlg-del");
    const pron = F.pronajmyBytu(byt, data.pronajmy);
    const letos = F.d(dnes()).getUTCFullYear();

    // stav editoru
    const st = zaznam ? { ...zaznam, polozky: (zaznam.polozky || []).map((p) => ({ ...p })) } : (() => {
      // období navazuje na poslední vyúčtování; končí koncem roku nebo dřív, když smlouva nájemce končí uprostřed roku
      const navrh = V.navrhObdobi(pron, data.vyuctovani.filter((x) => x.byt_id === byt.id), dnes());
      const od = navrh ? navrh.od : `${letos - 1}-01-01`, do_ = navrh ? navrh.do : `${letos - 1}-12-31`;
      const rok = Number(do_.slice(0, 4));
      const z = V.zalohyPodleSmluv(pron, od, do_);
      return { rok, od, do: do_, najemce: z.najemce || "", zaloha_mesic: z.zaloha_mesic, mesicu: z.mesicu || 12,
        zalohy_celkem: z.promenliva ? z.zalohy_celkem : null, odeslano: null, poznamka: "", polozky: vychoziPolozky(byt, od, V.pocetDni(od, do_)) };
    })();

    const hlavicka = [
      { k: "rok", l: "Rok", t: "int", req: true },
      { k: "od", l: "Období od", t: "date", req: true },
      { k: "do", l: "Období do", t: "date", req: true },
      { k: "najemce", l: "Nájemce", t: "text", wide: true },
      { k: "zaloha_mesic", l: "Záloha / měsíc [Kč]", t: "num" },
      { k: "mesicu", l: "Měsíců záloh", t: "num" },
      { k: "zalohy_celkem", l: "Zálohy celkem [Kč]", t: "num", wide: true, help: "Vyplň jen když se záloha v roce měnila – přepíše záloha × měsíce" },
      { k: "odeslano", l: "Odesláno nájemníkovi", t: "date" },
      { k: "poznamka", l: "Poznámka (zobrazí se na listině)", t: "area", wide: true },
    ];

    $("#dlg-title").textContent = zaznam ? `Vyúčtování ${zaznam.rok} – ${byt.nazev}` : `Nové vyúčtování – ${byt.nazev}`;
    err.hidden = true;
    del.hidden = !zaznam;
    dlg.classList.add("siroky");

    const vykresliPolozky = () => {
      $("#vy-polozky").innerHTML = st.polozky.map((p, i) => {
        const f = (k, l, extra = "") => `<label class="${extra}">${l}<input data-k="${k}" inputmode="decimal" value="${esc(mn(p[k]))}"></label>`;
        const pole_ = p.typ === "meridlo"
          ? f("stav_od", "Stav od") + f("stav_do", "Stav do") + f("cena", "Cena / jedn. [Kč]") + f("jednotka", "Jednotka") + f("spotreba", "Spotřeba ručně") + f("naklad_rucne", "Částka ručně [Kč]")
          : p.typ === "den" ? f("cena", "Sazba / den [Kč]") + f("dny", "Počet dní") + f("naklad_rucne", "Částka ručně [Kč]")
          : f("castka", "Částka [Kč]");
        return `<div class="pol" data-i="${i}">
          <div class="pol-top">
            <select data-k="typ" aria-label="Typ položky">${TYPY_POLOZEK.map(([k, t]) => `<option value="${k}" ${p.typ === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
            <button type="button" class="icon-btn" data-smaz title="Odebrat položku">✕</button>
          </div>
          <label class="wide">Název<input data-k="nazev" value="${esc(p.nazev || "")}" placeholder="např. Teplá voda"></label>
          <div class="pol-pole">${pole_}</div>
          <div class="pol-sum"></div>
        </div>`;
      }).join("") || `<p class="muted">Žádné položky.</p>`;
      prepocti();
    };

    const sebratPolozku = (p) => {
      const o = { typ: p.typ, nazev: (p.nazev || "").trim() };
      for (const k of ["stav_od", "stav_do", "spotreba", "cena", "dny", "castka", "naklad_rucne"]) if (k in p) o[k] = cisloMeke(p[k]);
      if (p.typ === "meridlo") o.jednotka = (p.jednotka || "").trim();
      return o;
    };
    const aktualni = () => ({
      zaloha_mesic: cisloMeke($("#f-vy-zaloha_mesic").value), mesicu: cisloMeke($("#f-vy-mesicu").value),
      zalohy_celkem: cisloMeke($("#f-vy-zalohy_celkem").value), polozky: st.polozky.map(sebratPolozku),
    });
    const prepocti = () => {
      const v = aktualni(), r = V.vypocet(v);
      $$(".pol", dlg).forEach((el, i) => {
        const n = r.polozky[i];
        el.querySelector(".pol-sum").innerHTML = `<b>${kc2(n.naklad)}</b>${n.typ === "meridlo" ? ` <span class="muted">spotřeba ${mn(V.spotreba(n))}</span>` : ""}`;
      });
      $("#vy-souhrn").innerHTML = `
        <div><span>Náklady</span><b>${kc2(r.naklady)}</b></div>
        ${r.odpocty ? `<div><span>Odečty</span><b>${kc2(r.odpocty)}</b></div>` : ""}
        <div><span>Náklady celkem</span><b>${kc2(r.celkem)}</b></div>
        <div><span>Zálohy</span><b>${kc2(r.zalohy)}</b></div>
        <div class="vysl ${r.preplatek ? "pos" : r.nedoplatek ? "neg" : ""}"><span>${vysledekText(r)}</span><b>${kc2(Math.abs(r.rozdil))}</b></div>
        ${r.maVyrovnani ? `<div><span>Kauce − srážky</span><b>${kc2(r.vyrovnani)}</b></div>
        <div class="vysl ${r.kVraceni >= 0 ? "pos" : "neg"}"><span>${r.kVraceni >= 0 ? "Celkem k vrácení nájemci" : "Celkem doplatí nájemce"}</span><b>${kc2(Math.abs(r.kVraceni))}</b></div>` : ""}`;
    };

    $("#dlg-fields").innerHTML = `
      <div class="fields vy-hlava">${hlavicka.map((p) => pole({ ...p, k: `vy-${p.k}`, wide: p.wide }, st[p.k])).join("")}</div>
      <div class="vy-nastroje">
        <button type="button" class="btn small" id="vy-doplnit">Doplnit zálohy ze smluv a dny z období</button>
        <button type="button" class="btn small" id="vy-pridat">+ Položka</button>
        <select id="vy-pridat-typ" aria-label="Typ nové položky">${TYPY_POLOZEK.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select>
      </div>
      <div id="vy-polozky" class="vy-polozky"></div>
      <div id="vy-souhrn" class="vy-souhrn"></div>`;
    vykresliPolozky();

    const cti = (id) => $(`#${id}`).value.trim();
    // pole s prefixem vy- (ať se neplete s polem v běžném formuláři); jména pro hodnotyFormulare
    const hlavickaPole = hlavicka.map((p) => ({ ...p, k: `vy-${p.k}` }));
    $("#vy-doplnit").onclick = () => {
      try {
        const od = cti("f-vy-od"), do_ = cti("f-vy-do");
        if (!od || !do_) throw new Error("Vyplň období od–do.");
        const z = V.zalohyPodleSmluv(pron, od, do_);
        const dny = V.pocetDni(od, do_);
        if (z.najemce) $("#f-vy-najemce").value = z.najemce;
        $("#f-vy-zaloha_mesic").value = mn(z.zaloha_mesic);
        $("#f-vy-mesicu").value = mn(z.mesicu || V.pocetMesicu(od, do_));
        $("#f-vy-zalohy_celkem").value = z.promenliva ? mn(z.zalohy_celkem) : "";
        st.polozky.forEach((p) => { if (p.typ === "den") p.dny = dny; });
        vykresliPolozky();
        toast(z.mesicu ? "Doplněno ze smluv" : "V tomto období není žádná smlouva – zálohy zadej ručně", !z.mesicu);
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    };
    $("#vy-pridat").onclick = () => { st.polozky.push({ ...NOVA_POLOZKA[$("#vy-pridat-typ").value] }); vykresliPolozky(); };
    $("#vy-polozky").oninput = (e) => {
      const el = e.target.closest("[data-k]");
      if (!el || el.tagName === "SELECT") return;
      st.polozky[+el.closest(".pol").dataset.i][el.dataset.k] = el.value;
      prepocti();
    };
    $("#vy-polozky").onchange = (e) => {
      const el = e.target.closest("select[data-k]");
      if (!el) return;
      const i = +el.closest(".pol").dataset.i, p = st.polozky[i];
      st.polozky[i] = { ...NOVA_POLOZKA[el.value], nazev: p.nazev || NOVA_POLOZKA[el.value].nazev };
      vykresliPolozky();
    };
    $("#vy-polozky").onclick = (e) => {
      const b = e.target.closest("[data-smaz]");
      if (!b) return;
      st.polozky.splice(+b.closest(".pol").dataset.i, 1);
      vykresliPolozky();
    };
    for (const id of ["f-vy-zaloha_mesic", "f-vy-mesicu", "f-vy-zalohy_celkem"]) $(`#${id}`).oninput = prepocti;

    $("#dlg-cancel").onclick = () => dlg.close();
    del.onclick = async () => {
      if (!confirm("Opravdu smazat vyúčtování?")) return;
      try { await provest(() => uloziste.smaz("vyuctovani", zaznam), "Smazáno"); dlg.close(); } catch (e) { err.textContent = e.message; err.hidden = false; }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      err.hidden = true;
      try {
        const h = hodnotyFormulare(hlavickaPole, form);
        const out = {};
        for (const p of hlavicka) out[p.k] = h[`vy-${p.k}`];
        if (out.od > out.do) throw new Error("Začátek období je po jeho konci.");
        const polozky = st.polozky.map((p) => {
          for (const k of ["stav_od", "stav_do", "spotreba", "cena", "dny", "castka", "naklad_rucne"]) if (k in p) cislo(p[k] ?? ""); // chyba = srozumitelná hláška
          return sebratPolozku(p);
        });
        if (polozky.some((p) => !p.nazev)) throw new Error("Každá položka musí mít název.");
        await provest(() => uloziste.uloz("vyuctovani", { ...out, byt_id: byt.id, polozky }, zaznam));
        dlg.close();
      } catch (e2) { err.textContent = e2.message; err.hidden = false; }
    };
    dlg.showModal();
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
