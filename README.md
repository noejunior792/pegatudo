# PegaTudo - Advanced Video Downloader

PegaTudo is a cutting-edge Chrome extension that revolutionizes how you download media content from the web. Featuring an advanced video detection engine with encryption support, streaming protocol handling, and AI-powered extraction algorithms.

## 🚀 Advanced Features

### 🎯 Intelligent Detection Engine
*   **Multi-Protocol Support:** Advanced HLS (.m3u8), DASH (.mpd), and adaptive bitrate streaming
*   **Encryption Handling:** AES-128, SAMPLE-AES decryption with automatic key extraction
*   **Deep Network Analysis:** Intercepts fetch/XHR/WebSocket requests for comprehensive media discovery
*   **Shadow DOM Scanning:** Detects hidden media in isolated DOM contexts
*   **Pattern Recognition:** Advanced algorithms for identifying obfuscated media URLs

### 🔒 Advanced Cryptography
*   **Native Decryption:** Pure JavaScript AES implementation for encrypted streams
*   **Key Derivation:** Mathematical algorithms for extracting encryption keys from manifests
*   **Multi-Key Streams:** Handles complex encryption scenarios with key rotation
*   **Segment Decryption:** Per-segment decryption with IV management

### 🌐 Platform-Specific Extractors
*   **YouTube:** Advanced extraction with quality selection and live stream support
*   **Facebook:** Comprehensive video detection including React components
*   **TikTok:** Multi-method extraction with music track separation
*   **Generic:** Universal extractor for unknown platforms

### 🎨 Professional UI
*   **Shadow DOM Isolation:** Zero interference with target websites
*   **Batch Downloads:** Select and download multiple files simultaneously
*   **Quality Selection:** Choose from available formats and resolutions
*   **Progress Tracking:** Real-time download progress with speed and ETA
*   **Dark/Light Themes:** Modern, responsive interface

### ⚡ Performance & Stealth
*   **Concurrent Downloads:** Multi-threaded downloading with intelligent queuing
*   **Request Randomization:** Mimics natural browser behavior to avoid detection
*   **Rate Limiting:** Respects server resources and avoids triggering anti-bot measures
*   **Memory Optimization:** Efficient handling of large files and streaming content

## 🛠️ Como Usar

1.  **Instale a Extensão:**
    *   Clone ou baixe este repositório.
    *   Abra seu navegador (Chrome, Brave, etc.) e navegue até a página de extensões (ex: `chrome://extensions`).
    *   Ative o "Modo de Desenvolvedor".
    *   Clique em "Carregar sem compactação" e selecione o diretório do projeto.

2.  **Baixando Mídias:**
    *   Abra a página que contém as mídias que você deseja.
    *   Clique no ícone do PegaTudo na barra de ferramentas do navegador.
    *   A popup mostrará uma lista de todas as mídias encontradas.
    *   Clique no botão de download ao lado do item desejado ou use o botão "Baixar Todos".

## 📂 Estrutura do Projeto

A estrutura foi refatorada para ser mais modular e escalável.

```
pegatudo/
├── src/
│   ├── css/
│   │   ├── features/
│   │   │   ├── media-list.css
│   │   │   ├── settings.css
│   │   │   └── toast.css
│   │   └── popup.css
│   ├── html/
│   │   └── settings.html
│   └── js/
│       ├── services/
│       │   ├── hls-downloader.js
│       │   ├── media-list.js
│       │   ├── settings.js
│       │   └── toast.js
│       ├── background.js
│       ├── content.js
│       ├── interceptor.js
│       ├── popup.js
│       └── utils.js
├── icons/
├── popup.html
├── manifest.json
├── README.md
├── LICENSE
└── CONTRIBUTING.md
```

## Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## Contribuição

Para saber como contribuir com o projeto, consulte o arquivo [`CONTRIBUTING.md`](CONTRIBUTING.md).
