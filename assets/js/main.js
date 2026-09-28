/* Portfolio — minimal progressive enhancement
   - mobile nav toggle
   - sticky header shadow on scroll
   - current year in footer
   - hero word rotator
   - scroll reveal for .reveal elements
*/
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Mobile nav ---- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- Sticky header border ---- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Footer year ---- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- Hero word rotator ---- */
  var rot = document.querySelector("[data-rotate]");
  if (rot) {
    var words = rot.getAttribute("data-rotate").split("|")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    if (words.length > 1) {
      // Stabilise the line: lock width to the widest word so following
      // text never jumps as words swap.
      var maxW = 0;
      words.forEach(function (w) { rot.textContent = w; maxW = Math.max(maxW, rot.offsetWidth); });
      rot.style.minWidth = Math.ceil(maxW) + "px";
      rot.textContent = words[0];

      if (!reduce) {
        var i = 0;
        window.setInterval(function () {
          rot.classList.add("is-swapping");
          window.setTimeout(function () {
            i = (i + 1) % words.length;
            rot.textContent = words[i];
            rot.classList.add("is-entering");
            rot.classList.remove("is-swapping");
            requestAnimationFrame(function () {
              requestAnimationFrame(function () { rot.classList.remove("is-entering"); });
            });
          }, 380);
        }, 2800);
      }
    }
  }

  /* ---- Scroll reveal ---- */
  var reveal = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveal.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
    reveal.forEach(function (el) { io.observe(el); });
  }
})();
