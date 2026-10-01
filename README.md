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
assets/js/main.js     nav, hotspots, terminal, mission-control demo
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

## 3D model

`assets/model/aanya.glb` powers the "Explore AANYA in 3D" viewer and the point-cloud rover in the hangar. It is made from the Fusion STEP export:

```bash
pip install cadquery-ocp trimesh scipy
python tools/step_to_glb.py "assembly final.step" model-full.glb
npx gltfpack -i model-full.glb -o assets/model/aanya.glb -kn -km -cc   # compress (~2.4 MB)
```

Part names shown on the site come from `tools/part_names.json` (rename rules, translations of vendor part names, which assemblies to split). Edit it and re-run to change what visitors see. STEP files are git-ignored.

## Deploy

Hosted on **GitHub Pages** straight from this repo: every push to the branch goes live within a minute or two.

- Turn it on once: repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `claude/kind-pasteur-4znwcj`, folder `/ (root)`.
- Free address: `https://saathviku-cmd.github.io/bad-bunny-/`
- Custom domain (e.g. `teamaanya.com`): buy it at any registrar, then add these DNS records:
  - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
  - `CNAME` record for `www` → `saathviku-cmd.github.io`

  Then put the domain in Settings → Pages → Custom domain (this creates a `CNAME` file in the repo) and tick **Enforce HTTPS** once it's offered.
