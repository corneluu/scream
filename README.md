# Scream Runner 🎤🏃

> A voice-controlled endless runner — **scream to run, stop to end**.

## Play Online
👉 **[https://YOUR-USERNAME.github.io/YOUR-REPO-NAME](https://YOUR-USERNAME.github.io/YOUR-REPO-NAME)**
*(replace with your actual GitHub Pages URL after deploy)*

## How to Play
1. Click **PRESS TO START** and allow microphone access
2. Stay quiet for 3 seconds (auto-calibration)
3. Pick or create a character (Boy 👦 or Girl 👧)
4. **SCREAM** — louder = faster, longer = more distance
5. Stop screaming → game ends and shows your result

## Features
- 🎤 Real-time voice detection via Web Audio API
- 🏃 3D perspective endless hallway with neon grid
- 👦👧 Animated gendered character sprites
- 📊 Run history log (browser console + Stats page)
- 🌐 English / Romanian language support

## Local Development
Just open `index.html` in Firefox, or serve with:
```bash
npx serve .
```
Then open `http://localhost:3000`

> Chrome blocks microphone on `file://`. Use a server.

## Deploy to GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings → Pages → Source → GitHub Actions**
3. The workflow in `.github/workflows/pages.yml` deploys automatically on every push to `main`
