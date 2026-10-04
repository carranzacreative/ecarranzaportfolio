/* ==========================================================================
   main.js — the gallery, the filters and the lightbox.

   Everything on the page is generated from window.PORTFOLIO, so adding a
   project is a one-line JSON edit (see project-meta.json) instead of a markup
   change. No framework, no build step: this file is served as-is.

   Markup contract with style.css:
     .filter[aria-selected]   .card[.card-featured]   .card-frame
     .card-lqip   .card-img   .card-tag   .card-rel   .card-body
      .card-title   .card-meta
   ========================================================================== */

(function () {
  "use strict";

  var DATA = window.PORTFOLIO;
  var IMG_DIR = "assets/img/";

  /* ---------------------------------------------------------------- utils */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null && text !== undefined) node.textContent = text;
    return node;
  }

  function setText(sel, value) {
    var node = $(sel);
    if (node) node.textContent = value;
  }

  /* "In-house role · PreZero · 2023 · Fabric booth graphic · 13×10 ft" —
     skipping any part that is empty keeps untitled pieces from showing
     dangling separators. */
  function metaLine(item) {
    return [item.engagement, item.client, item.year, item.medium].filter(Boolean).join(" · ");
  }

  function imgPath(file) { return IMG_DIR + file; }

  /* Contact details live in portfolio-data.js so they only have to be corrected
     in one place. The markup ships working defaults, so a missing field simply
     leaves the default in place rather than blanking the line. */
  function hydrateContact(owner) {
    var email = $("#contact-email");
    var cta = $("#contact-cta");
    if (owner.email) {
      if (email) {
        email.textContent = owner.email;
        email.href = "mailto:" + owner.email;
      }
      if (cta) cta.href = "mailto:" + owner.email;
    }

    var phone = $("#contact-phone");
    if (owner.phone) {
      if (phone) phone.textContent = owner.phone;
      // A tel: link must be dialable: digits and a leading +, never the printed
      // "(530) 405-7647". A bare 10-digit US number needs the country code.
      var digits = owner.phone.replace(/\D/g, "");
      if (digits.length === 10) digits = "1" + digits;
      if (phone) phone.href = "tel:+" + digits;
    }

    setText("#contact-location", owner.location);
    /* The handle is read out of the profile URL, so the text lives in its own
       span: #contact-linkedin also holds the hexagon mark, and assigning
       textContent to the anchor would delete the icon along with it. */
    var linkedin = $("#contact-linkedin-text");
    if (linkedin && owner.linkedin) {
      /* A profile URL ends in a slash, and "…/eduardo-carranza-7960743b/".split("/")
         pops an empty string -- which is why this strips trailing slashes before
         taking the last segment. Without it the label hydrates to a bare "in/". */
      var handle = owner.linkedin.replace(/\/+$/, "").split("/").pop();
      linkedin.textContent = "in/" + handle;
    }
  }

  /* -------------------------------------------------------------- hydrate */

  function hydrate() {
    if (!DATA) {
      setText("#stat-projects", "0");
      setText("#stat-pieces", "0");
      return false;
    }

    var owner = DATA.owner || {};
    setText("#owner-name", owner.name);
    setText("#owner-role", owner.role);
    setText("#footer-name", owner.name);

    var tagline = $("#hero-tagline");
    if (tagline && owner.tagline) {
      tagline.textContent = owner.tagline;
      var dot = el("span", "accent", ".");
      tagline.appendChild(dot);
    }

    setText("#stat-projects", String((DATA.projects || []).length));
    setText("#stat-pieces", String((DATA.items || []).length));
    setText("#year", String(new Date().getFullYear()));

    // Optional: the experience stat is absent when the data file predates it.
    if (owner.years) setText("#stat-years", owner.years + " years");

    hydrateContact(owner);
    return true;
  }

  /* --------------------------------------------------------------- header */

  /* The header only earns its border once the page has scrolled under it.
     rAF-throttled so a fast trackpad flick does not thrash layout. */
  function initHeader() {
    var header = $(".site-header");
    if (!header) return;

    var ticking = false;
    function update() {
      header.classList.toggle("is-stuck", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------- hero parallax */

  /* A gentle drift on the portrait as the hero scrolls away. Restrained on
     purpose: the movement is a few dozen pixels across the whole hero, so the
     page still reads as a static document first and an animated one second.
     Larger amplitudes make a portfolio feel like a template.

     Only the portrait moves. The headline, the disciplines band and the grid are
     left completely still -- parallax on body copy is what makes scrolling feel
     unstable, and the grid is a fixed 4:3 lattice where any drift reads as a
     misaligned card rather than as depth.

     Everything here is a no-op when the visitor has asked for reduced motion, so
     the effect never runs against that preference. */

  var reduceMotion = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initParallax() {
    var frame = $(".portrait-frame");
    var hero = $(".hero");
    if (!frame || !hero) return;

    /* Without this the JS would keep writing translateY() on every frame even
       where CSS has already flattened the effect, so reduced-motion users would
       still pay for the scroll handler. */
    if (reduceMotion) return;

    /* Above this viewport width the hero is a two-column grid and the portrait
       has room to drift inside its column. Below it the portrait is centred and
       full-bleed, where even a small offset exposes the edge of the cut-out. */
    var MIN_WIDTH = 900;

    var ticking = false;

    function update() {
      ticking = false;

      if (window.innerWidth < MIN_WIDTH) {
        frame.style.transform = "";
        return;
      }

      /* getBoundingClientRect is the only layout read per frame; everything else
         is arithmetic on the result. The hero's height is measured too, so the
         effect is proportional to how far the hero is rather than to raw pixels
         -- a very tall hero would otherwise drift at several times the speed. */
      var heroBox = hero.getBoundingClientRect();
      var viewport = window.innerHeight || 1;

      if (heroBox.bottom <= 0) return;             /* scrolled past: leave it be */
      if (heroBox.top >= viewport) return;          /* not reached yet */

      /* progress: 0 when the hero's top meets the top of the viewport, 1 when its
         bottom does. Clamped so a bounce or an over-scroll cannot push the
         portrait past its intended travel. */
      var progress = (heroBox.top / heroBox.height) * -1;
      if (progress < 0) progress = 0;
      else if (progress > 1) progress = 1;

      /* Down to about 40px of travel across the full hero. Odd values are used
         so the resting position is exactly 0 and the transform can start unset. */
      var offset = Math.round(progress * -40);

      frame.style.transform = "translate3d(0," + offset + "px,0)";
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    /* Resize changes whether parallax applies and re-measures the hero, so the
       transform has to be recomputed rather than left at the old breakpoint's
       value. */
    window.addEventListener("resize", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    update();
  }

  /* --------------------------------------------------------------- filters */

  var state = { filter: "all", items: [], visible: [] };

  function countFor(id, items) {
    return items.filter(function (i) { return i.project === id; }).length;
  }

  function buildFilters(items) {
    var host = $("#filters");
    if (!host) return;
    host.textContent = "";

    var options = [{ id: "all", name: "All work" }].concat(DATA.projects || []);
    options.forEach(function (p) {
      var count = p.id === "all" ? items.length : countFor(p.id, items);
      if (p.id !== "all" && count === 0) return;   // no empty categories

      var btn = el("button", "filter");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.dataset.filter = p.id;
      btn.appendChild(document.createTextNode(p.name));
      btn.appendChild(el("span", "count", String(count)));
      btn.addEventListener("click", function () { setFilter(p.id); });
      host.appendChild(btn);
    });
  }

  function setFilter(id) {
    state.filter = id;
    state.visible = id === "all"
      ? state.items.slice()
      : state.items.filter(function (i) { return i.project === id; });

    $$(".filter", $("#filters")).forEach(function (btn) {
      btn.setAttribute("aria-selected", String(btn.dataset.filter === id));
    });

    // Filtering re-renders rather than hiding, so the grid never keeps stale
    // cards around and the entrance animation replays on every switch.
    renderGrid(state.visible);

    var empty = $("#empty-state");
    if (empty) empty.hidden = state.visible.length > 0;
  }

  /* ----------------------------------------------------------------- grid */

  function buildCard(item, index) {
    var card = el("button", "card");
    card.type = "button";
    card.dataset.project = item.project;
    card.dataset.slug = item.slug;
    if (item.featured) card.classList.add("card-featured");

    // The project filter is a tablist; roving focus means arrow keys move
    // between cards instead of tabbing through all 36 of them.
    card.setAttribute("role", "tab");
    card.tabIndex = index === 0 ? 0 : -1;

    var frame = el("div", "card-frame");

    // Blur-up placeholder: a ~350 byte inline JPEG painted immediately behind
    // the real image so there is never an empty grey box.
    var lqip = el("img", "card-lqip");
    lqip.src = item.lqipData || "";
    lqip.alt = "";
    lqip.setAttribute("aria-hidden", "true");
    frame.appendChild(lqip);

    var card_ = item.variants.card || {};
    var full_ = item.variants.full || {};
    var img = el("img", "card-img");
    img.alt = item.title + " — " + metaLine(item);
    img.loading = "lazy";
    img.decoding = "async";
    img.width = card_.w || item.srcW;
    img.height = card_.h || item.srcH;
    img.src = imgPath(card_.webp || full_.webp || item.variants.thumb.webp);

    // Hand the browser both widths so it can pick per-DPR and per-viewport.
    var srcset = [];
    if (card_.webp) srcset.push(imgPath(card_.webp) + " " + card_.w + "w");
    if (full_.webp) srcset.push(imgPath(full_.webp) + " " + full_.w + "w");
    if (srcset.length) img.srcset = srcset.join(", ");

    frame.appendChild(img);

    var project = (DATA.projects || []).filter(function (p) { return p.id === item.project; })[0];
    if (project) frame.appendChild(el("span", "card-tag", project.name));

    /* In-house work was produced as an employee rather than freelance, so it is
       badged rather than folded into the meta line: it is the distinction a
       hiring manager is actually reading for. */
    if (item.inhouse) {
      var badge = el("span", "card-rel", "In-house");
      frame.appendChild(badge);
    }

    var body = el("div", "card-body");
    body.appendChild(el("h3", "card-title", item.title));
    body.appendChild(el("p", "card-meta", metaLine(item)));

    card.appendChild(frame);
    card.appendChild(body);
    return card;
  }

  function renderGrid(items) {
    var grid = $("#grid");
    if (!grid) return;
    grid.textContent = "";

    var frag = document.createDocumentFragment();
    items.forEach(function (item, i) { frag.appendChild(buildCard(item, i)); });
    grid.appendChild(frag);
    wireGridKeys();
  }

  /* Arrow-key navigation between cards. */
  function wireGridKeys() {
    var grid = $("#grid");
    if (!grid || grid.dataset.keys === "on") return;
    grid.dataset.keys = "on";

    grid.addEventListener("keydown", function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in keys)) return;

      var cards = $$(".card", grid);
      var i = cards.indexOf(document.activeElement);
      if (i === -1) return;

      e.preventDefault();
      var next = Math.min(cards.length - 1, Math.max(0, i + keys[e.key]));
      cards.forEach(function (c) { c.tabIndex = -1; });
      cards[next].tabIndex = 0;
      cards[next].focus();
    });
  }

  /* ------------------------------------------------------------- lightbox */

  /* open/close/step, driven by one piece of state so the counter, the caption
     and the image can never disagree with each other. */
  var lb = { index: -1, lastFocus: null };

  function openLightbox(index, trigger) {
    var box = $("#lightbox");
    if (!box || !state.visible.length) return;

    lb.index = (index + state.visible.length) % state.visible.length;
    lb.lastFocus = trigger || document.activeElement;
    box.hidden = false;
    document.body.classList.add("lb-open");
    paint();
    var close = $("#lb-close");
    if (close) close.focus();
  }

  function closeLightbox() {
    var box = $("#lightbox");
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove("lb-open");
    if (lb.lastFocus && lb.lastFocus.focus) lb.lastFocus.focus();
    lb.index = -1;
  }

  function step(delta) {
    if (lb.index === -1) return;
    openLightbox(lb.index + delta, lb.lastFocus);
  }

  function paint() {
    var item = state.visible[lb.index];
    if (!item) return;

    var img = $("#lb-img");
    var full_ = item.variants.full || {};
    if (img) {
      img.src = imgPath(full_.webp || full_.jpg || "");
      img.alt = item.title + " — " + metaLine(item);
    }

    setText("#lb-title", item.title);
    setText("#lb-meta", metaLine(item));
    setText("#lb-blurb", item.blurb || "");
    setText("#lb-counter", (lb.index + 1) + " / " + state.visible.length);

    // Hide the blurb line entirely when a piece has no description, so the
    // caption does not show an empty gap.
    var blurb = $("#lb-blurb");
    if (blurb) blurb.hidden = !item.blurb;

    var single = state.visible.length < 2;
    ["#lb-prev", "#lb-next"].forEach(function (sel) {
      var b = $(sel);
      if (b) b.hidden = single;
    });
  }

  function initLightbox() {
    var box = $("#lightbox");
    if (!box) return;

    $("#grid").addEventListener("click", function (e) {
      var card = e.target.closest(".card");
      if (!card) return;
      var index = state.visible.findIndex(function (i) { return i.slug === card.dataset.slug; });
      if (index !== -1) openLightbox(index, card);
    });

    $("#lb-close").addEventListener("click", closeLightbox);
    $("#lb-prev").addEventListener("click", function () { step(-1); });
    $("#lb-next").addEventListener("click", function () { step(1); });
    $("#lb-backdrop").addEventListener("click", closeLightbox);

    document.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "Escape") { closeLightbox(); }
      else if (e.key === "ArrowLeft") { step(-1); }
      else if (e.key === "ArrowRight") { step(1); }
    });
  }

  /* ------------------------------------------------------------------ go */

  function init() {
    initHeader();
    initParallax();
    if (!hydrate()) {
      var empty = $("#empty-state");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Portfolio data could not be loaded.";
      }
      return;
    }

    state.items = DATA.items || [];
    buildFilters(state.items);
    setFilter("all");
    initLightbox();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();