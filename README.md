<div align="center">
  <img src="assets/logo.png" alt="Family Webs Logo" width="200"/>

  # Family Webs

  **A browser-based visual family tree builder**

  [![GitHub Pages](https://img.shields.io/badge/demo-live-green.svg)](https://f3nici.github.io/familywebs)

</div>

---

## 📖 About

**Family Webs** is a visual family tree builder inspired by FamilyBushes. It renders clean relationship maps, supports fluid layouts, and handles complex structures like remarriages, step-families, and half-siblings. Trees are stored as JSON and can be imported and exported freely.

This tool is **entirely browser-based** with no backend required, making it lightweight, fast, and privacy-friendly.

---

## ✨ Features

* 🌳 **Create and edit full family trees** with an intuitive interface
* 👨‍👩‍👧‍👦 **Supports complex relationships**: remarriages, step relations, and blended families
* 🎨 **Fluid map layout** that visually arranges families automatically
* 📦 **JSON import and export** for easy data portability
* 🔄 **Compatible with FamilyBushes JSON format**
* 👁️ **View-only and editable modes** for sharing and collaboration
* 🚀 **Entirely browser-based** with no backend or database needed
* ⚡ **Lightweight and fast** with minimal dependencies

---

## 🚀 Quick Start

### Option 1: Docker Compose (View-Only Deployment)

The easiest way to deploy Family Webs in **view-only mode** is using Docker Compose. This is perfect for sharing a family tree publicly without allowing edits.

The `viewonly` branch is a special deployment branch that:
- Contains a pre-configured `family.json` file with your family tree data
- Runs in read-only mode (no editing capabilities)
- Automatically updates when changes are pushed to the branch
- Perfect for static hosting and public sharing

**Create a `docker-compose.yml` file:**

```yaml
services:
  fetcher:
    image: alpine/git
    entrypoint: /bin/sh
    command: >
      -c '
        if [ ! -d /site/.git ]; then
          git clone -b viewonly https://github.com/f3nici/familywebs.git /site;
        else
          cd /site && git fetch && git checkout viewonly && git pull origin viewonly;
        fi

        if [ -f /site/family.json ]; then
          chmod 644 /site/family.json
        fi
      '
    volumes:
      - ./site:/site
  web:
    image: nginx:alpine
    volumes:
      - ./site:/usr/share/nginx/html:ro
    ports:
      - 8090:80
    depends_on:
      - fetcher
networks: {}
```

**Deploy:**

```bash
docker-compose up -d
```

**Access your family tree:**

```
http://localhost:8090
```

**How it works:**
1. The `fetcher` service clones the `viewonly` branch from GitHub
2. It ensures the `family.json` file has proper permissions
3. The `web` service serves the static files via Nginx
4. The site is mounted read-only (`:ro`) for security
5. On restart, it pulls the latest changes from the `viewonly` branch

---

### Option 2: Running Locally

#### 1. Clone the repository

```bash
git clone https://github.com/f3nici/familywebs.git
cd familywebs
```

#### 2. Start a local server

**Python:**

```bash
python -m http.server 8000
```

**Node:**

```bash
npx serve .
```

**Open in browser:**

```
http://localhost:8000
```

> **Note:** This tool must be **served over HTTP** because browsers block module loading when opened via `file://`.

---

## 🌐 Hosting Options

Recommended static hosting platforms:

* **GitHub Pages** - Free, easy setup
* **Netlify** - Automatic deployments
* **Vercel** - Fast global CDN
* **Cloudflare Pages** - Excellent performance
* **Docker** - Self-hosted with full control
* Any static file hosting service

---

## 📚 Usage

### Creating a New Tree

1. Open the hosted site
2. Select **"New Tree"**
3. Add people and define their family connections
4. Use the visual interface to build relationships

### Importing a Tree (FamilyBushes Compatible)

The JSON format used by this project is **the same format used by FamilyBushes**.

**To import a FamilyBushes tree:**

1. In FamilyBushes, click **Export**
2. You will get a file ending in `.FBFT`
3. Use **7zip** (or any unzip tool) to extract it
4. Inside the extracted folder you will find a JSON file
5. Import that JSON into Family Webs

---

## 🔧 JSON Format

This project uses the **same structure as FamilyBushes** for maximum compatibility.

**Example:**

```json
{
  "people": [
    {
      "id": 1,
      "name": "John Smith",
      "gender": "male",
      "birthDate": "1950-01-01",
      "parents": [],
      "spouses": [2],
      "children": [3, 4]
    },
    {
      "id": 2,
      "name": "Jane Doe",
      "gender": "female",
      "birthDate": "1952-03-15",
      "parents": [],
      "spouses": [1],
      "children": [3, 4]
    },
    {
      "id": 3,
      "name": "Alice Smith",
      "gender": "female",
      "birthDate": "1975-06-20",
      "parents": [1, 2],
      "spouses": [],
      "children": []
    }
  ]
}
```

**Key fields:**
- `id`: Unique identifier for each person
- `name`: Full name
- `gender`: "male", "female", or "other"
- `birthDate`: ISO date format (optional)
- `parents`: Array of parent IDs
- `spouses`: Array of spouse IDs
- `children`: Array of children IDs

IDs reference relationships across the tree, creating the web of connections.

---

## 🐙 Deploying to GitHub Pages

1. Push the repository to GitHub
2. Go to **Settings → Pages**
3. Choose **Deploy from branch**
4. Select your branch (e.g., `main`) and the root folder
5. GitHub Pages will publish your site automatically
6. Visit:

   ```
   https://<username>.github.io/familywebs
   ```

7. (Optional) Add a custom domain in the settings

---

## 🤝 Contributing

Pull requests are welcome!

1. Open an issue first to discuss the improvement
2. Describe the enhancement in detail
3. Submit a PR with clear commit messages
4. Ensure compatibility with existing features

---

## 🙏 Acknowledgments

Inspired by **FamilyBushes** and built with love for genealogy enthusiasts worldwide.

---

<div align="center">
  Made with ❤️ by f3nici
</div>
