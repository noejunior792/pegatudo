# PegaTudo

O PegaTudo é uma extensão para Chrome que transforma a maneira como você baixa conteúdo da web. Cansado de não conseguir baixar aquele vídeo ou imagem? Com o PegaTudo, você pode baixar praticamente qualquer mídia, de qualquer site.

## ✨ Funcionalidades

*   **Downloads Universais:** Baixe vídeos, imagens, áudios e outros arquivos de qualquer site.
*   **Suporte a Vários Formatos:** Suporte completo para `Blob`, `File`, `ArrayBuffer`, `Data URLs`, `MediaStream` e `Object URLs`.
*   **Gravação de Tela:** Grave a tela, a câmera ou o áudio diretamente do navegador.
*   **Downloads Progressivos:** Acompanhe o progresso de downloads grandes.
*   **Detecção Inteligente:** Detecta mídias inseridas dinamicamente na página.
*   **Interface Isolada:** A interface do usuário não entra em conflito com o estilo da página.
*   **Modo de Depuração:** Ative o modo de depuração para ver logs detalhados no console.

## 🛠️ Como Usar

1.  **Instale a Extensão:**
    *   Clone ou baixe este repositório.
    *   Abra o Google Chrome e navegue até `chrome://extensions`.
    *   Ative o "Modo de Programador".
    *   Clique em "Carregar sem compactação" e selecione o diretório do projeto.

2.  **Baixando Mídias:**
    *   Passe o mouse sobre qualquer vídeo, imagem ou áudio.
    *   Clique no botão **"Baixar"**.

3.  **Gravando a Tela:**
    *   Passe o mouse sobre um vídeo.
    *   Clique no botão **"Gravar Tela"**.

## 📂 Estrutura do Projeto

```
pegatudo/
├── src/
│   ├── js/
│   │   ├── background.js
│   │   ├── content.js
│   │   ├── interceptor.js
│   │   ├── popup.js
│   │   └── utils.js
│   └── css/
│       └── popup.css
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