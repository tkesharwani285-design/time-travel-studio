# Time-Travel Drawing Studio

A drawing app with **branching history**. Undo, draw something different, and the old
future is kept as a branch you can jump back to from the version tree.

## How the history works
- Every edit creates a **version** (a node) that points to its parent.
- **Undo** moves to the parent version. **Redo** moves to the most recently visited child.
- Drawing after an undo creates a **new child**, so the earlier future stays as a branch.
- Click any version in the timeline to restore that exact drawing.

## Features
Pen, line, rectangle, circle, eraser, colour picker, stroke width, zoom, PNG export,
autosave in the browser, and shareable links (the whole version tree is encoded in the URL).

## Run locally
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```
Requires Node 22+.

## Deploy
Push to GitHub, import the repo in Vercel, and click Deploy. No environment variables are
required for the current version.

## Roadmap
- Accounts and cloud-saved projects (Supabase)
- Ghost preview of another branch
- Version thumbnails
