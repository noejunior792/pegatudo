chrome.runtime.onInstalled.addListener(() => {
    console.log("PegaTudo instalado.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "download") {
        handleStreamDownload(message, sendResponse);
        return true; // Keep channel open for async response
    }
});

async function handleStreamDownload({ url, filename }, sendResponse) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            chunks.push(value);
            receivedLength += value.length;
            // Optional: send progress update to UI
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
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, downloadId });
            }
        });

    } catch (error) {
        sendResponse({ error: error.message });
    }
}