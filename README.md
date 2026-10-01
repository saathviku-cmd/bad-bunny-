# Team AANYA — Website

Showcase site for **Project AANYA**, a student-built 6WD autonomous rover with a robotic arm and an NVIDIA Jetson Orin Nano edge-AI brain.

Plain HTML/CSS/JS, no build step. Open `index.html` or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Structure

```
index.html            all page sections
assets/css/style.css  styles (brand colours are the variables at the top)
assets/js/main.js     boot screen, hotspots, terminal, mission-control demo
assets/img/           renders, build photos, logo (logo-mark.svg, logo-vertical.svg)
assets/video/         put clips here
```

## Adding videos

- **Hero background:** save a short, compressed clip as `assets/video/hero.mp4`. It plays automatically behind the hero, and the "Watch it move" button opens it. Aim for under ~10 MB (1080p, 10–20 s, no audio).
- **Gallery:** add `<video>` tiles in the `#gallery` section of `index.html`.
- Keep files under GitHub's 100 MB limit. Host long videos on YouTube and embed them.

## Placeholders to fill in

Search `index.html` for `TODO`:

- College name (About section)
- Team member names and roles (Team section)
- Contact email (Join section)

## Deploy

Static hosting works anywhere: Vercel, Netlify, or GitHub Pages (Settings → Pages → deploy from branch).
