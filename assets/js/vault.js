/* Password-protected design files
   Each [data-vault] section holds an encrypted list of links (AES-GCM, key derived from the
   password with PBKDF2). Nothing readable is in the page source: the right password is the
   only thing that turns the ciphertext back into links, and it all happens in the browser.
   One password opens every case study, but nothing is remembered: leaving the page (or
   coming back to it with the Back button) locks it again.
   tools/lock.html uses Vault.encrypt() to produce the data-iv / data-ct values. */
(function () {
  "use strict";

  var SALT = "portfolio-vault-v1";
  var ITERATIONS = 310000;
  var enc = new TextEncoder();
  var subtle = window.crypto && window.crypto.subtle;

  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    var s = "";
    new Uint8Array(bytes).forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s);
  }

  function deriveRaw(password) {
    return subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]).then(function (base) {
      return subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(SALT), iterations: ITERATIONS, hash: "SHA-256" }, base, 256);
    });
  }
  function toKey(raw) {
    return subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  function decrypt(key, ivB64, ctB64) {
    return subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(ivB64) }, key, b64ToBytes(ctB64))
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }

  window.Vault = {
    encrypt: function (password, files) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return deriveRaw(password).then(toKey).then(function (key) {
        return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(files)));
      }).then(function (ct) { return { iv: bytesToB64(iv), ct: bytesToB64(ct) }; });
    }
  };

  var vaults = document.querySelectorAll("[data-vault]");
  if (!vaults.length) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function render(vault, files, focus) {
    var list = vault.querySelector(".vault__files");
    list.textContent = "";
    files.forEach(function (f) {
      var li = el("li");
      var a = el("a", "vault__file");
      a.href = f.u;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.appendChild(el("span", "vault__kind", f.k));
      a.appendChild(el("span", "vault__file-title", f.t));
      a.appendChild(el("span", "vault__file-desc", f.d));
      var open = el("span", "vault__open");
      open.appendChild(document.createTextNode("Open file "));
      open.appendChild(el("span", "arrow", "↗")).setAttribute("aria-hidden", "true");
      var sr = el("span", "visually-hidden", " (opens in a new tab)");
      open.appendChild(sr);
      a.appendChild(open);
      li.appendChild(a);
      list.appendChild(li);
    });
    vault.classList.add("is-open");
    vault.querySelector(".vault__status").textContent = "";
    vault.querySelector(".vault__form").hidden = true;
    vault.querySelector(".vault__hint").hidden = true;
    vault.querySelector(".vault__intro").textContent = "Unlocked. These are the NDA-protected designs and files behind this case study. They open in Figma. Please keep them confidential.";
    list.hidden = false;
    if (focus) { var first = list.querySelector("a"); if (first) first.focus(); }
  }

  function unlockWith(vault, key, focus) {
    return decrypt(key, vault.getAttribute("data-iv"), vault.getAttribute("data-ct"))
      .then(function (files) { render(vault, files, focus); return true; });
  }

  /* Back/forward can restore a page from memory exactly as it was left; reload so it comes back locked. */
  window.addEventListener("pageshow", function (e) { if (e.persisted) location.reload(); });
  try { sessionStorage.removeItem("vault-key"); } catch (e) {}

  vaults.forEach(function (vault) {
    var form = vault.querySelector(".vault__form");
    var input = vault.querySelector("input");
    var status = vault.querySelector(".vault__status");
    var button = form.querySelector("button");

    if (!subtle) {
      status.textContent = "Unlocking needs a secure (https) connection.";
      return;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var pw = input.value;
      if (!pw) { status.textContent = "Enter the password first."; input.focus(); return; }
      button.disabled = true;
      status.textContent = "Checking…";
      vault.classList.remove("is-wrong");
      deriveRaw(pw).then(function (raw) {
        return toKey(raw).then(function (key) { return unlockWith(vault, key, true); });
      }).catch(function () {
        status.textContent = "That password didn't open it. Check it and try again.";
        vault.classList.add("is-wrong");
        input.select();
      }).then(function () { button.disabled = false; });
    });

    input.addEventListener("input", function () {
      if (vault.classList.contains("is-wrong")) { vault.classList.remove("is-wrong"); status.textContent = ""; }
    });
  });
})();
