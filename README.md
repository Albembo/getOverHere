# getOverHere - Resource override plugin 💾

> **⚠️ ALPHA STATUS:** This plugin is currently in early alpha. Features and configurations may change.

An open-source, lightweight, cross-browser extension built with Manifest V3 to dynamically manage CORS Overrides and URL Redirects during web development.

It helps you manage your network layer by keeping it completely customizable.

## 🚀 Features

- **Manifest V3 Compliant:** Fully operational under modern extension ecosystems.
- **Cross-Browser:** Works on Chromium-based browsers (Chrome, Edge, Opera) and Firefox.
- **Dynamic CORS Overrides:** Instantly inject `Access-Control-Allow-Origin: *` headers into blocked requests.
- **Regex-Based Redirects:** Map production files (e.g., live scripts) directly to your `localhost` debugging environment in real time.
- **Configuration Import/Export:** Easily share rules using `.json` files.

## 🛠️ How to Load the Extension (Unpacked)

Since the extension is currently in alpha and not yet published to marketplaces, you can load it manually:

### 1. Build the Extension
```bash
npm install
npm run build
```

### 2. Load into Your Browser

**For Google Chrome / Edge / Chromium:**
1. Navigate to `chrome://extensions/` in your browser.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `dist/` folder created by the build process.

**For Mozilla Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside your `dist/` directory.

## 📝 Configuration Schema Example

When importing or exporting configurations, rule sets use the following clear structured data schema format:

```json
[
  {
    "id": "env_1",
    "name": "Local Development",
    "isCurrent": true,
    "rules": [
      {
        "id": "rule_1",
        "type": "redirect",
        "sourceUrl": "^https://.*\\.example\\.com/(.*\\.js)$",
        "targetUrl": "http://localhost:9000/\\1",
        "active": true
      },
      {
        "id": "rule_2",
        "type": "cors",
        "sourceUrl": "||cdnimg.example.com",
        "active": true
      }
    ]
  }
]
```

## 🤝 Contributing

Contributions are welcome! Please feel free to open a Pull Request.

## 📄 License

Distributed under the GNU GPLv3 License. See `LICENSE` for more information.
