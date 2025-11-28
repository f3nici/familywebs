# `familytree`

**familytree** is a browser-based visual family tree builder inspired by FamilyBushes. It renders clean relationship maps, supports fluid layouts, and handles complex structures like remarriages, step-families and half-siblings. Trees are stored as JSON and can be imported and exported freely.

This tool must be **served over HTTP** because browsers block module loading when opened via `file://`.

---

## Features

* Create and edit full family trees
* Supports remarriages, step relations and blended families
* Fluid map layout that visually arranges families
* JSON import and export
* Compatible with **FamilyBushes JSON format**
* View-only and editable modes
* Entirely browser-based with no backend
* Lightweight and fast

---

## Demo / Hosting

You must **host the project** or run it under a local web server. Opening `index.html` directly from your computer will not work due to browser restrictions.

Recommended hosting:

* GitHub Pages
* Netlify
* Vercel
* Cloudflare Pages
* Any static host

---

## Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/f3nici/familytree.git
cd familytree
```

### 2. Start a local server

Python:

```bash
python -m http.server 8000
```

Node:

```bash
npx serve .
```

Open:

```
http://localhost:8000
```

---

## Usage

### Creating a new tree

* Open the hosted site
* Select “New Tree”
* Add people and define their family connections

### Importing a tree (FamilyBushes compatible)

The JSON format used by this project is **the same format used by FamilyBushes**.
To import a FamilyBushes tree:

1. In FamilyBushes, click **Export**
2. You will get a file ending in `.FBFT`
3. Use **7zip** (or any unzip tool) to extract it
4. Inside the extracted folder you will find a JSON file
5. Import that JSON into this project

### Exporting

* Click **Export**
* Saves a `.json` file compatible with this project and FamilyBushes

### Navigation

* Drag to move around
* Scroll to zoom
* Click a person to view or edit their details

---

## JSON Format

This project uses the **same structure as FamilyBushes**.

Example:

```json
{
  "people": [
    {
      "id": 1,
      "name": "John Smith",
      "gender": "male",
      "parents": [],
      "spouses": [2],
      "children": [3]
    }
  ]
}
```

IDs reference relationships across the tree.

---

## Deploying to GitHub Pages

1. Push the repository to GitHub
2. Go to `Settings → Pages`
3. Choose **Deploy from branch**
4. Select your branch and the root folder
5. GitHub Pages will publish your site
6. Visit:

   ```
   https://<username>.github.io/familytree
   ```

---

## Future Enhancements

* More advanced relationship edge rendering
* Attachments for profiles (images, docs)
* GEDCOM import
* Sharing via URL encoding
* Full component-based refactor version

---

## Contributing

Pull requests are welcome. For large changes:

* Open an issue
* Describe the improvement
* Submit a PR with clear commit descriptions
