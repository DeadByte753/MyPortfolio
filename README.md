# John Emmanuel T. Suante — Portfolio

Personal portfolio site. Plain HTML, CSS and JavaScript, with no build step.

## Structure

```
suante-portfolio/
├── index.html                 Page content (all sections)
├── css/
│   └── style.css              Colors, fonts, layout, animations, light/dark theme
├── js/
│   └── main.js                Theme switch, animations, skills orbit, terminal, map, pop-ups
└── assets/
    ├── images/                Profile photo, guild logos, event photos
    └── certificates/          Certificate images shown in the Achievements section
```

## Run it

Open `index.html` in a browser. To publish it, upload the whole folder to GitHub Pages, Netlify or Vercel and keep the folder layout the same.

## Common edits

- **Profile photo:** replace `assets/images/profile.webp` (a square image works best).
- **Text, projects, achievements:** edit `index.html`. Each section starts with a comment such as `<!-- PROJECTS -->`.
- **Colors:** change the variables at the top of `css/style.css` (`--accent`, `--bg` and so on). Light-mode colors are in the two blocks right after.
- **Skills orbit:** each planet is a `<button class="node">` in the SKILLS section of `index.html`. `data-cat` sets its group (`lang`, `web`, `mobile`, `sec`, `tools`).
- **Terminal text:** edit the `L` list under `/* ---------- terminal ---------- */` in `js/main.js`.
- **Map location:** `HOME` in the map section of `js/main.js` holds the coordinates of Poblacion, Malinao.
- **Resume button:** it opens the resume pop-up in `index.html`. To offer a PDF instead, add `resume.pdf` to the folder and change the button into `<a class="btn primary" href="resume.pdf" download>`.
