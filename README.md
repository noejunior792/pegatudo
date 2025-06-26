# PegaTudo

O PegaTudo é uma extensão para Chrome que transforma a maneira como você baixa conteúdo da web. Cansado de não conseguir baixar aquele vídeo ou imagem? Com o PegaTudo, você pode baixar praticamente qualquer mídia, de qualquer site, com a ajuda da poderosa ferramenta de linha de comando `yt-dlp`.

## ✨ Funcionalidades

*   **Downloads Universais de Vídeo:** Gera comandos de download para vídeos em qualquer site, não apenas no YouTube. Se o `yt-dlp` consegue baixar, você também consegue!
*   **Download de Imagens e Áudios:** Baixe imagens e áudios com um único clique.
*   **Suporte a Playlists do YouTube:** Gere um único comando para baixar todos os vídeos de uma playlist do YouTube de uma só vez.
*   **Integração com `yt-dlp`:** Em vez de tentar reinventar a roda, o PegaTudo integra-se perfeitamente com o `yt-dlp`, a ferramenta padrão-ouro para downloads de vídeo, garantindo a máxima qualidade e confiabilidade.

## 🐧 Otimizado para Linux

Esta extensão foi desenhada a pensar nos utilizadores de Linux. A sua funcionalidade principal baseia-se na geração de comandos que podem ser colados diretamente no terminal. Para usar todo o poder do PegaTudo, você precisará ter o `yt-dlp` instalado no seu sistema.

**Instalando o `yt-dlp`:**
```bash
sudo apt update
sudo apt install yt-dlp
```

## 🛠️ Como Usar

1.  **Instale a Extensão:**
    *   Clone ou baixe este repositório:
        ```bash
        git clone https://github.com/noejunior792/pegatudo.git
        ```
    *   Abra o Google Chrome e navegue até `chrome://extensions`.
    *   Ative o "Modo de Programador" no canto superior direito.
    *   Clique em "Carregar sem compactação".
    *   Selecione o diretório onde você clonou/baixou o repositório.

2.  **Para Vídeos:**
    *   Passe o mouse sobre qualquer vídeo em qualquer site.
    *   Clique no botão **"Gerar Comando de Download"**.
    *   Cole o comando copiado no seu terminal e pressione Enter. A mágica acontece!

3.  **Para Playlists do YouTube:**
    *   Navegue até uma página de playlist no YouTube.
    *   Clique no botão **"Gerar Comando para Playlist"** que aparece no cabeçalho da playlist.
    *   Cole o comando no seu terminal para baixar todos os vídeos.

4.  **Para Imagens e Áudios:**
    *   Passe o mouse sobre a imagem ou áudio e clique em **"Baixar"**.

## Objetivos para o Crescimento do PegaTudo

Para garantir que o PegaTudo continue a ser uma ferramenta útil e abrangente, temos os seguintes objetivos de desenvolvimento:

- [x] **Melhorar a Detecção e Download de Conteúdo:**
    - [ ] Expandir a capacidade de detecção para incluir mais tipos de mídia (áudios, documentos, etc.).
    - [ ] Aprimorar a lógica de download para lidar com diferentes estruturas de sites e plataformas.
    - [ ] Implementar o download direto de stickers e outros formatos de mídia específicos de plataformas como WhatsApp.

- [ ] **Suporte Abrangente a Plataformas:**
    - [ ] Garantir compatibilidade total com as principais plataformas de vídeo e imagem (YouTube, Instagram, TikTok, Facebook, Twitter, etc.).
    - [ ] Desenvolver funcionalidades específicas para o download de status do WhatsApp e outras mídias efêmeras.

- [ ] **Interface do Usuário Amigável e Intuitiva:**
    - [ ] Refinar a experiência do usuário, tornando a detecção e o download de conteúdo ainda mais simples e acessíveis.
    - [ ] Fornecer feedback claro ao usuário sobre o status do download e possíveis erros.

- [ ] **Otimização de Performance:**
    - [ ] Garantir que a extensão seja leve e não afete negativamente o desempenho do navegador.
    - [ ] Otimizar o processo de download para ser rápido e eficiente.

- [ ] **Manutenção e Atualizações Contínuas:**
    - [ ] Monitorar e adaptar a extensão às mudanças nas plataformas e tecnologias da web.
    - [ ] Lançar atualizações regulares com novas funcionalidades e correções de bugs.

## Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## Contribuição

Para saber como contribuir com o projeto, consulte o arquivo [`CONTRIBUTING.md`](CONTRIBUTING.md).
