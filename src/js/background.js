chrome.runtime.onInstalled.addListener(() => {
    console.log("PegaTudo instalado.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "download") {
        handleStreamDownload(message, sender.tab.id);
        sendResponse({ success: true });
    }
    return true;
});

async function handleStreamDownload({ url, filename }, tabId) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let receivedLength = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            chunks.push(value);
            receivedLength += value.length;

            if (contentLength) {
                const progress = Math.round((receivedLength / total) * 100);
                chrome.tabs.sendMessage(tabId, { action: 'downloadProgress', progress, filename });
            }
        }

        const blob = new Blob(chunks);
        const downloadUrl = URL.createObjectURL(blob);

        chrome.downloads.download({
            url: downloadUrl,
            filename: filename,
            conflictAction: 'uniquify'
        }, (downloadId) => {
            URL.revokeObjectURL(downloadUrl);
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            }
        });

    } catch (error) {
        console.error(error);
    }
}