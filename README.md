# Portfolio

A small, fast, editorial portfolio site — plain HTML, CSS, and a sprinkle of vanilla JS.
No build step, no framework, no dependencies. Structure is inspired by
[nicolearoberts.com](https://www.nicolearoberts.com/).

## Run it

Just open `index.html` in a browser. For clean local URLs, serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Structure

```
index.html                     Home — hero, selected work, strengths, testimonials
work.html                      Index of all case studies
about.html                     Bio, background, contact
case-studies/
  ai-item-summaries.html       Full case-study template (most detailed)
  onboarding-redesign.html     Case study
  design-system.html           Case study
assets/
  css/style.css                All styling + design tokens (light theme)
  js/main.js                   Mobile nav, scroll reveal, footer year
  img/                         Put your images here
  resume.pdf                   Drop your résumé here (linked from the nav)
```

## Making it yours — checklist

All copy is placeholder. Search-and-replace these:

- [x] **Name** — set to Dhanushka Liyanage (every page's `<title>`, header banner, footer, About heading)
- [ ] **`you@example.com`** → your email
- [ ] **`https://www.linkedin.com/`** → your LinkedIn URL
- [ ] **`Your City`**, hero tagline, and the "meta-inline" line in `index.html`
- [ ] **Hero rotating words** — the `data-rotate="clear | usable | …"` attribute on the
      `.rotator` span in `index.html` (pipe-separated; edit or add your own)
- [ ] **Strengths** section in `index.html` — six cells
- [ ] **Testimonials** in `index.html` — names, titles, quotes
- [ ] **About** page — background list, tools, "outside work", pull quote
- [ ] **Case studies** — rewrite each with your real project, or delete/duplicate files.
      If you add or remove one, update the links in `index.html`, `work.html`,
      and the "Next case study" block at the bottom of each case study.
- [ ] **Images** — replace every `<div class="placeholder">…</div>` with
      `<img src="../assets/img/your-image.jpg" alt="describe it" />`
- [ ] **Favicon** — the inline SVG `data:` URI in each `<head>` (currently a "Y" tile)
- [ ] **`assets/resume.pdf`** — add the file

## Design tokens

Colors, type scale, spacing, and radius live as CSS custom properties at the top of
`assets/css/style.css` (`:root { … }`). The site is light-theme only, like the
reference — there's no dark mode.
Change the accent in one place: `--accent`.

Fonts are Fraunces (display) + Inter (body), loaded from Google Fonts. Swap the
`<link>` in each `<head>` and the `--font-*` tokens to change them.

## Deploy

It's static, so anything works:

- **Netlify / Vercel / Cloudflare Pages** — drag the folder in, or connect the repo.
- **GitHub Pages** — push to a repo, enable Pages on the `main` branch, root folder.

## License

Yours. Do what you like with it.

## Hero character

The home-page hero is one section: your intro copy on the left and an interactive
character on the right (they stack on screens narrower than ~980px, copy first).
She watches your real cursor.

- **Follows the cursor:** move the mouse and her head turns toward it, smoothly,
  from far left through facing you to far right.
- **Greets you:** rest the cursor near her for a moment and she notices you, takes
  the headset off, waves and points down at the portfolio once, then goes back to
  her laptop. It won't repeat for ~14 seconds, so sweeping the cursor across the
  page doesn't set it off.
- **Goes back to work:** leave the window or stop moving for a few seconds and she
  returns to typing at her laptop.
- **Never locks you out:** the hover greeting happens once per visit, and if you move
  the cursor well away mid-greeting she stops and follows it. Clicking her (or the
  keyboard "Say hello" button) greets any time.
- **Small remarks:** park the cursor far to one side and a small message appears
  ("Anyone here on the left?").
- **Phones / touch:** there's no cursor, so she greets once when she scrolls into
  view; tap to replay.

- **Text:** the headline, intro, role line and buttons are `.hero__copy` in
  `index.html`; the speech pills are in `assets/js/hero.js` (`LINES` and `CUES`); the
  cursor hint is `.stage__hint`.
- **Look:** the stage is plain white. Her laptop is recoloured to silver inside the
  frames, and the frames' backdrop is normalised to white with the edges faded out
  (see `tools/build-hero-frames.swift`).
- **Frames:** 182 JPEGs in `assets/hero/` (about 7.9 MB, loaded in the background
  after the first paint). To regenerate them from a different video, see the
  header of `tools/build-hero-frames.swift`.
- **Reduced motion:** the character stays still and the left/right areas just show
  their message.
- `assets/img/herovideo.mp4` is the original clip and is no longer used by the
  page; delete it if you don't need it.
