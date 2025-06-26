# PegaTudo (MediaDownloader)

PegaTudo is a Chrome extension that allows you to easily download videos, GIFs, and images from almost any website. It provides convenient controls directly over the media elements for a seamless experience.

## Features

*   **Direct Downloads:** Download media with a single click from a control panel that appears over the content.
*   **Download Management:** Pause and resume your downloads directly from the web page.
*   **Video Summarization:** Get a quick summary of videos before or after downloading (placeholder feature).
*   **Dynamic Content Support:** Automatically detects media added to the page after the initial load.
*   **Handles Authenticated URLs:** Can be configured to work with media on pages that require authentication.

## How It Works

The extension automatically detects media elements (like `<video>` and `<img>`) on the pages you visit. When you hover over a piece of media, a small control panel appears with the following options:

*   **Download:** Starts the download of the media file.
*   **Pause/Resume:** Controls the download process.
*   **Summarize:** (For videos only) Provides a text summary of the video content.

## How to Install

1.  Clone or download this repository.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" in the top right corner.
4.  Click on "Load unpacked".
5.  Select the directory where you cloned/downloaded the repository.

The extension icon will appear in your Chrome toolbar.