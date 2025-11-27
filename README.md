# Family Roots

Family Roots is a single-page React app for building and exploring interactive family trees directly in the browser. It supports remarriages, half-siblings, and other complex relationships while keeping your data on your device via local storage.

## Features

- Create new trees and persist them locally in the browser.
- Add people with birth/death details, genders, and custom attributes.
- Build relationships that include spouses, parents, children, remarriages, and half-siblings.
- Toggle edit/view modes to protect data when sharing or presenting.
- Import and export tree data as formatted JSON files for backup or sharing.
- Search the member list to quickly jump to any person in the tree.
- Share a view-only link generated from the current tree data.

## Project structure

- `family_tree_app.html` – HTML shell that loads React from a CDN and mounts the app.
- `app.js` – All React components, state management, and interaction logic.
- `styles.css` – Layout and visual design for the tree, lists, and controls.

## Running locally

This project has no build step. Open `family_tree_app.html` in a modern browser, or serve the folder with a simple HTTP server:

```bash
python -m http.server 8000
```

Then visit [http://localhost:8000/family_tree_app.html](http://localhost:8000/family_tree_app.html).

## Importing and exporting data

- **Export**: Use the **Export** button in the header to download the current tree as a JSON file.
- **Import**: Use the **Import** button (or the welcome screen) to load a JSON file you previously exported.

## Editing the tree

1. Click **Create New Tree** on the welcome screen, or import an existing JSON export.
2. Use **Edit Mode** to add family members, set genders, and fill in birth/death events.
3. Add relationships via the **Add Person** and **Add Marriage** actions in the sidebar when edit mode is on.
4. Switch to **View Only** to prevent accidental changes while browsing or sharing.

All changes are automatically saved to `localStorage` in your browser.

## Sharing

Use the **Share** button in the header to copy a URL that encodes the current tree data. Send the link to others so they can explore your tree without editing it.
