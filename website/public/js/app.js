/**
 * Compressy frontend — single Alpine entry point.
 *
 * Every interactive element registers its Alpine component here via
 * alpine:init, and opts in from its template with x-data="<name>".
 * This file MUST load before /vendor/alpine.min.js (both deferred —
 * execution order follows document order).
 */
document.addEventListener("alpine:init", () => {
  /**
   * Mobile navigation toggle. Progressive enhancement only — links work
   * with JS disabled.
   */
  Alpine.data("nav", () => ({
    open: false,
    toggle() {
      this.open = !this.open;
    },
    close() {
      this.open = false;
    },
  }));
});

/**
 * Release filtering (downloads page) — delegated, no Alpine dependency.
 * Search text AND the active tag chip combine (AND).
 */
(function () {
  function apply() {
    const input = document.querySelector(".release-search");
    const q = (input instanceof HTMLInputElement ? input.value : "").trim().toLowerCase();
    const activeChip = document.querySelector(".release-filterbar .chip.is-on:not([data-chip='all'])");
    const tag = activeChip instanceof HTMLElement ? activeChip.dataset.chip : "";
    document.querySelectorAll("[data-release]").forEach((el) => {
      const okText = !q || el.textContent.toLowerCase().includes(q);
      const tags = (el.dataset.tags || "").split(/\s+/).filter(Boolean);
      const okTag = !tag || tags.includes(tag);
      el.style.display = okText && okTag ? "" : "none";
    });
  }
  document.addEventListener("input", (ev) => {
    if (ev.target instanceof Element && ev.target.matches(".release-search")) apply();
  });
  document.addEventListener("click", (ev) => {
    const chip = ev.target instanceof Element ? ev.target.closest(".release-filterbar [data-chip]") : null;
    if (!chip) return;
    document
      .querySelectorAll(".release-filterbar .chip")
      .forEach((c) => c.classList.toggle("is-on", c === chip));
    apply();
  });
})();

/**
 * Copy SHA-256 to clipboard from release asset rows.
 */
document.addEventListener("click", (ev) => {
  const link = ev.target instanceof Element ? ev.target.closest("[data-copy-sha]") : null;
  if (!link) return;
  ev.preventDefault();
  const sha = link.getAttribute("data-copy-sha") || "";
  if (navigator.clipboard) navigator.clipboard.writeText(sha).catch(() => {});
  const prev = link.textContent;
  link.textContent = "Copied";
  setTimeout(() => (link.textContent = prev), 1200);
});
/**
 * Download feedback toast — delegated, so any CTA pointing at /download
 * gets confirmation without extra markup. Navigation proceeds normally.
 */
(function () {
  let timer = null;
  let el = null;
  function show() {
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.setAttribute("role", "status");
      el.textContent = "Starting download…";
      document.body.appendChild(el);
    }
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest('a[href="/download"]') : null;
    if (target) show();
  });
})();
