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
  css/style.css                All styling + design tokens + dark mode
  js/main.js                   Mobile nav, scroll reveal, footer year
  img/                         Put your images here
  resume.pdf                   Drop your résumé here (linked from the nav)
```

## Making it yours — checklist

All copy is placeholder. Search-and-replace these:

- [ ] **`Your Name`** → your name (appears in every page's `<title>`, header, footer)
- [ ] **`you@example.com`** → your email
- [ ] **`https://www.linkedin.com/`** → your LinkedIn URL
- [ ] **`Your City`**, hero tagline, and the "meta-inline" line in `index.html`
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
`assets/css/style.css` (`:root { … }`), with a `prefers-color-scheme: dark` override.
Change the accent in one place: `--accent`.

Fonts are Fraunces (display) + Inter (body), loaded from Google Fonts. Swap the
`<link>` in each `<head>` and the `--font-*` tokens to change them.

## Deploy

It's static, so anything works:

- **Netlify / Vercel / Cloudflare Pages** — drag the folder in, or connect the repo.
- **GitHub Pages** — push to a repo, enable Pages on the `main` branch, root folder.

## License

Yours. Do what you like with it.
