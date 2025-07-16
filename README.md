# PegaTudo

O PegaTudo é uma extensão para Chrome que transforma a maneira como você baixa conteúdo da web. Com um painel de mídia centralizado, ele detecta e lista todos os vídeos, imagens e áudios de uma página, permitindo que você baixe o que quiser com um único clique.

## ✨ Funcionalidades

*   **Painel de Mídia Centralizado:** Todas as mídias detectadas na página são listadas de forma organizada na popup da extensão.
*   **Downloads Universais:** Baixe vídeos, imagens e áudios com facilidade.
*   **Suporte a Streaming HLS:** Baixa vídeos de streams HLS (`.m3u8`), juntando todos os segmentos em um único arquivo.
*   **Baixar Todos:** Baixe todas as mídias diretas (não-stream) da página com um único botão.
*   **Detecção Inteligente:** Intercepta o tráfego da página para encontrar mídias carregadas dinamicamente.
*   **Notificações de Progresso:** Acompanhe o andamento dos downloads de stream através de notificações.
*   **Página de Configurações:** Personalize o comportamento da extensão, como ativar o modo de depuração.

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
