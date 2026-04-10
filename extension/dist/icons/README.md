# JobFlow App Icons

This directory contains the application icons in various sizes for different use cases.

## Icon Design

The JobFlow icon features:
- **Gradient background**: Blue to purple gradient representing AI and technology
- **Briefcase symbol**: White briefcase representing job tracking
- **Flow elements**: Connected dots showing workflow and process
- **AI spark**: Gold accent representing AI assistance

## Sizes Available

- **16x16**: Browser favicon, small UI elements
- **32x32**: Standard favicon, taskbar
- **48x48**: Extension icon (medium)
- **96x96**: Extension icon (large)  
- **128x128**: Extension icon (extra large)
- **192x192**: PWA icon (Android)
- **512x512**: PWA icon (large, store listings)

## Usage

### Extension Manifests
```json
"icons": {
  "16": "icons/16/icon.png",
  "32": "icons/32/icon.png", 
  "48": "icons/48/icon.png",
  "96": "icons/96/icon.png",
  "128": "icons/128/icon.png"
}
```

### HTML Favicons
```html
<link rel="icon" type="image/png" sizes="32x32" href="icons/32/icon.png">
<link rel="icon" type="image/png" sizes="16x16" href="icons/16/icon.png">
```

## Source

Original SVG source: `jobflow-icon.svg`
Generated using the icon generator tool: `icon-generator.html`