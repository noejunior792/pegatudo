# PegaTudo - Production-Ready Browser Extension

<div align="center">
  <img src="icons/icon128.png" alt="PegaTudo Logo" width="128">
  
  **Download videos, images, audio, and streams from any website with ease**
  
  [![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-brightgreen)](https://chrome.google.com/webstore)
  [![Brave Browser](https://img.shields.io/badge/Brave%20Browser-Compatible-orange)](https://brave.com)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
</div>

## 🌟 Features

### Core Functionality
- **Universal Media Detection**: Automatically detects videos, images, audio, and streaming content
- **Multi-Platform Support**: Works on YouTube, Facebook, Instagram, Twitter, TikTok, and thousands of other sites
- **Advanced Streaming Support**: Downloads HLS (.m3u8) and DASH (.mpd) streams by merging segments
- **Blob URL Detection**: Captures protected media through blob: URL interception
- **Batch Downloads**: Select multiple files and download them all at once
- **Real-time Detection**: Updates media list as new content loads dynamically

### User Interface
- **Clean, Responsive Design**: Modern popup interface with categorized media lists
- **Multi-Selection**: Checkboxes for selecting specific media files
- **Progress Tracking**: Real-time download progress for streaming content
- **Status Indicators**: Clear feedback for download states and errors
- **Category Organization**: Separate sections for videos, images, audio, and streams

### Advanced Features
- **Custom Naming Patterns**: Personalize how downloaded files are named
- **Auto-Download Mode**: Automatically download detected media (optional)
- **Network Request Interception**: Uses declarativeNetRequest API for enhanced detection
- **Memory Optimization**: Efficient handling of large media lists and downloads
- **Debug Mode**: Detailed logging for troubleshooting issues

### Browser Compatibility
- **Manifest V3**: Future-proof extension architecture
- **Brave Browser Optimized**: Fully compatible with Brave 1.80.120+
- **Chrome/Chromium**: Works on all Chromium-based browsers
- **Edge Support**: Microsoft Edge compatibility

## 🚀 Installation

### Method 1: Load Unpacked (Development)

1. **Download the Extension**
   ```bash
   git clone https://github.com/noejunior792/pegatudo.git
   cd pegatudo
   ```

2. **Open Brave/Chrome Extensions Page**
   - Navigate to `brave://extensions/` (Brave) or `chrome://extensions/` (Chrome)
   - Enable "Developer mode" in the top right

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `pegatudo` directory
   - The extension icon should appear in your toolbar

### Method 2: Package Installation

1. **Create Extension Package**
   ```bash
   # Zip the extension files (excluding .git)
   zip -r pegatudo-extension.zip . -x "*.git*" "README.md" "CONTRIBUTING.md"
   ```

2. **Install Package**
   - Go to `brave://extensions/`
   - Enable "Developer mode"
   - Drag and drop the `.zip` file onto the extensions page

## 📖 Usage Guide

### Basic Usage

1. **Navigate to Any Website**
   - Visit a page with videos, images, or audio
   - The extension automatically starts detecting media

2. **Open the Extension**
   - Click the PegaTudo icon in your browser toolbar
   - View all detected media organized by type

3. **Download Media**
   - Click the download button (📥) next to any item
   - Or select multiple items and click "Baixar Selecionados"
   - Use "Baixar Todos" to download everything

### Advanced Features

#### Custom File Naming
1. Open Settings (⚙️ button in popup)
2. Enable "Nomes Personalizados"
3. Set your pattern using placeholders:
   - `{filename}` - Original filename
   - `{timestamp}` - Unix timestamp
   - `{date}` - Current date (YYYY-MM-DD)
   - `{time}` - Current time (HH-MM-SS)
   - `{type}` - Media type (video, image, etc.)

#### Auto-Download Mode
- ⚠️ **Use with caution** - may download many files
- Enable in Settings → "Download Automático"
- Automatically downloads detected media without user interaction

#### Debug Mode
- Enable in Settings → "Modo de Depuração"
- Open browser console (F12) to see detailed logs
- Useful for troubleshooting detection issues

### Streaming Media Support

#### HLS Streams (.m3u8)
- Automatically detected from network requests
- Downloads and merges all video segments
- Progress shown in real-time notifications
- Final file saved as `.ts` format

#### DASH Streams (.mpd)
- Support for basic DASH manifests
- Segment downloading and merging
- Fallback to direct download for complex manifests

## 🔧 Troubleshooting

### Common Issues

#### "No media found"
- **Cause**: Page hasn't loaded media yet or uses protected streams
- **Solution**: Wait for page to fully load, try refreshing, enable DOM detection in settings

#### Downloads fail silently
- **Cause**: Browser blocking downloads or CORS restrictions
- **Solution**: Check browser's download settings, ensure site allows downloads

#### Extension not detecting media
- **Cause**: Site uses advanced protection or unusual loading methods
- **Solution**: Enable debug mode, check console for errors, try DOM detection

#### UI elements missing on websites
- **Cause**: CSS conflicts (rare with current version)
- **Solution**: Disable extension temporarily, report issue with specific site

### Debug Information

Enable debug mode and check console for:
- `PegaTudo: Media discovered` - Shows detected media
- `PegaTudo: Content script initialized` - Confirms script loading
- Network request logs for streaming content

### Supported Sites

The extension works on virtually any website, with enhanced support for:

#### Video Platforms
- ✅ YouTube (most videos)
- ✅ Facebook/Meta
- ✅ Instagram
- ✅ Twitter/X
- ✅ TikTok
- ✅ Twitch
- ✅ Vimeo
- ✅ Dailymotion

#### General Websites
- ✅ News sites with embedded media
- ✅ Social media platforms
- ✅ Educational sites
- ✅ Streaming services (where technically possible)
- ✅ Any site with standard HTML5 media

## ⚙️ Configuration

### Settings Overview

| Setting | Description | Default |
|---------|-------------|---------|
| Debug Mode | Show detailed console logs | Off |
| Auto Download | Automatically download detected media | Off |
| Custom Naming | Use custom filename patterns | Off |
| Max Concurrent | Maximum simultaneous downloads | 3 |
| Auto Refresh | Update media list every 3 seconds | On |
| DOM Detection | Scan page elements for media | On |

### Performance Tips

1. **Reduce concurrent downloads** if experiencing browser slowdowns
2. **Disable auto-refresh** on media-heavy pages
3. **Use selective downloads** instead of "Download All" for large lists
4. **Clear extension storage** periodically (browser settings)

## 🔒 Privacy & Security

### Data Handling
- **No data collection**: Extension doesn't send data to external servers
- **Local processing**: All media detection happens locally
- **No tracking**: No analytics or user behavior tracking
- **Minimal permissions**: Only requests necessary browser permissions

### Permissions Explained
- `downloads`: Required for file downloads
- `activeTab`: Access current tab for media detection
- `storage`: Save user preferences
- `declarativeNetRequest`: Intercept network requests for media detection
- `host_permissions`: Access all websites for universal compatibility

### Security Features
- **Isolated content scripts**: Prevent conflicts with website functionality
- **Safe DOM manipulation**: No interference with website UI
- **Error boundaries**: Graceful failure handling
- **Memory management**: Automatic cleanup to prevent resource leaks

## 🛠️ Development

### Project Structure
```
pegatudo/
├── manifest.json              # Extension manifest
├── popup.html                # Extension popup UI
├── src/
│   ├── js/
│   │   ├── background.js      # Service worker
│   │   ├── content.js         # Content script
│   │   ├── interceptor.js     # Network interception
│   │   ├── popup.js          # Popup logic
│   │   ├── utils.js          # Utility functions
│   │   └── services/
│   │       ├── hls-downloader.js    # HLS/DASH support
│   │       ├── settings.js          # Settings management
│   │       └── toast.js            # Notifications
│   ├── css/
│   │   ├── popup.css         # Main popup styles
│   │   └── features/
│   │       ├── media-list.css      # Media list styles
│   │       ├── settings.css        # Settings page styles
│   │       └── toast.css          # Toast notifications
│   └── html/
│       └── settings.html     # Settings page
├── icons/                    # Extension icons
└── README.md                # This file
```

### Building from Source

1. **Clone Repository**
   ```bash
   git clone https://github.com/noejunior792/pegatudo.git
   cd pegatudo
   ```

2. **Validate Code**
   ```bash
   # Check JavaScript syntax
   find . -name "*.js" -exec node -c {} \;
   ```

3. **Package Extension**
   ```bash
   zip -r pegatudo-v2.2.zip . -x "*.git*" "*.md" "CONTRIBUTING*"
   ```

### Testing

#### Automated Testing
```bash
# Syntax validation
find . -name "*.js" -exec node -c {} \;

# Extension loading test
# Load in browser and check console for errors
```

#### Manual Testing Sites
- **YouTube**: Test video detection and streaming
- **Instagram**: Test image and story media
- **Facebook**: Test video and image posts
- **News sites**: Test embedded media
- **HTML5 test pages**: Test basic media elements

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

### Getting Help
1. **Check this README** for common solutions
2. **Enable debug mode** and check browser console
3. **Report issues** with specific site URLs and error messages

### Known Limitations
- Some streaming services use advanced DRM protection
- Sites with complex JavaScript loading may need page refresh
- Very large playlists may take time to process
- Some blob: URLs expire quickly and may fail to download

### Future Enhancements
- [ ] Support for more streaming formats
- [ ] Enhanced DASH manifest parsing
- [ ] Playlist/batch URL processing
- [ ] Advanced filtering options
- [ ] Export/import settings
- [ ] Scheduled downloads

---

<div align="center">
  <strong>PegaTudo - Making media downloads simple and reliable</strong><br>
  Built with ❤️ for the open source community
</div>
