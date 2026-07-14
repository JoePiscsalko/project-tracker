# reLink Medical — Project Tracker

A lightweight, dependency-free project tracker that runs entirely in the browser. Track tasks, owners, status, priorities and deadlines, with automatic countdowns and a summary dashboard.

No build step. No framework. No server. Just three files.

---

## Files

```
relink-project-tracker/
├── index.html        ← structure
├── css/styles.css    ← all styling + brand colors
├── js/app.js         ← all logic
└── README.md
```

---

## Changing the brand colors

Open `css/styles.css`. The **first six lines** of the file are the only colors you need to touch:

```css
:root{
  --brand-navy:      #0e2a47;
  --brand-navy-deep: #071b30;
  --brand-green:     #29a35a;
  --brand-green-deep:#1e7f44;
  --brand-green-tint:#e6f4ec;
  --brand-sky:       #1c7ed6;
}
```

Swap in the official hex codes from the reLink brand guide and the whole app re-skins itself — buttons, progress bars, the dashboard, status pills, everything. Nothing else in the file needs to change.

> The current values are a close approximation of the reLink navy-and-green palette, not the official codes. Replace them when you have the real ones.

---

## Putting it live on GitHub Pages

### Option A — through the GitHub website (no command line)

1. Go to [github.com/new](https://github.com/new) and create a repository named `project-tracker`. Set it to **Public** (GitHub Pages requires public repos on free accounts). Don't add a README — you already have one.
2. On the new empty repo page, click **uploading an existing file**.
3. Drag in `index.html`, `README.md`, and the `css` and `js` folders. Click **Commit changes**.
4. Go to **Settings → Pages** (left sidebar).
5. Under **Source**, choose **Deploy from a branch**. Set branch to `main` and folder to `/ (root)`. Click **Save**.
6. Wait about a minute, then refresh. Your live URL appears at the top:

   ```
   https://<your-username>.github.io/project-tracker/
   ```

### Option B — through the command line

```bash
cd relink-project-tracker

git init
git add .
git commit -m "Initial commit: project tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/project-tracker.git
git push -u origin main
```

Then follow steps 4–6 above to switch Pages on.

### Making changes afterward

```bash
# edit your files, then:
git add .
git commit -m "Update brand colors"
git push
```

The live site rebuilds automatically, usually within a minute.

---

## How the data works

Tasks are stored in your browser's `localStorage`, keyed to the domain the page is served from. A few consequences worth knowing:

- **Your data is local to your browser.** It isn't uploaded anywhere, and it isn't shared between teammates — two people visiting the same GitHub Pages URL will each see their own board.
- **Different browser or device = different board.** Use **Save file** to export a `project-tracker.json` and **Load file** to bring it in elsewhere.
- **Clearing browser data wipes the board.** Export a backup periodically.

If you need a genuinely shared, multi-user board, this design won't get you there — that requires a backend. This tool is built for one person tracking their own work, and it does that without any infrastructure at all.

---

## Features

| Feature | Notes |
|---|---|
| Add / edit / delete tasks | Modal form with validation |
| Inline status dropdown | Color-coded; setting Complete auto-fills 100% |
| Deadline countdown | Red when overdue, amber within 3 days, green when done |
| Progress bars | Per task, plus an overall average on the dashboard |
| Filter | By status |
| Sort | Deadline, priority, status, name, or % complete |
| Export CSV | Opens cleanly in Excel |
| Save / Load JSON | Full backup and restore |
| Responsive | Works down to mobile |
| Keyboard | `Esc` closes the modal; visible focus rings throughout |

---

## Running it locally

Just open `index.html` in a browser. That's it — no server needed.
