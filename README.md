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

## Videos

Cut from the team's test film, plus a trailer rendered in code from the CAD renders and footage (H.264, muted, web-optimised):

| File | Used in | Content |
|---|---|---|
| `hero.mp4` | Hero background loop | Code-rendered trailer, no titles |
| `trailer.mp4` | "Watch the trailer" button, In Action player | 16 s trailer with titles |
| `aanya-film.mp4` | In Action player | Full 2:48 film |
| `drive.mp4`, `arm.mp4`, `grab.mp4`, `lights.mp4`, `dashboard.mp4` | In Action player | Individual tests |

Stills for posters live in `assets/img/still-*.jpg`. To swap a clip, replace the file with the same name. Keep files under GitHub's 100 MB limit; host long videos on YouTube.

## Placeholders to fill in

Search `index.html` for `TODO`:

- College name (About section)


Contact details (phone, email, WhatsApp) are in the Contact section and footer.

## Deploy

Static hosting works anywhere: Vercel, Netlify, or GitHub Pages (Settings → Pages → deploy from branch).
