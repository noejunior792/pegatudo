const processedElements = new WeakSet();
let extensionEnabled = true;
let mediaRecorder = null;
let recordedChunks = [];

chrome.storage.sync.get(['extensionEnabled'], (result) => {
    extensionEnabled = result.extensionEnabled !== false;
    if (extensionEnabled) {
        initialize();
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'toggleExtension') {
        extensionEnabled = message.enabled;
        if (extensionEnabled) {
            initialize();
        } else {
            removeAllUI();
        }
    }
});

function initialize() {
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });
}

function removeAllUI() {
    document.querySelectorAll('.pega-tudo-container').forEach(el => el.remove());
}

function createButtonContainer(element) {
    const container = document.createElement('div');
    container.className = 'pega-tudo-container';

    const shadowRoot = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        .pega-tudo-button {
            all: unset;
            background-color: #007bff;
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-family: sans-serif;
            font-size: 14px;
            margin-left: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: background-color 0.3s;
        }
        .pega-tudo-button:hover {
            background-color: #0056b3;
        }
        .pega-tudo-button.recording {
            background-color: #dc3545;
        }
    `;
    shadowRoot.appendChild(style);

    element.parentElement.style.position = 'relative';
    element.parentElement.appendChild(container);

    return shadowRoot;
}

async function handleDownload(url, element) {
    let blob, filename;

    try {
        if (url.startsWith('blob:')) {
            const response = await fetch(url);
            blob = await response.blob();
            filename = `blob_${Date.now()}.${getFileExtension(blob.type)}`;
        } else if (url.startsWith('data:')) {
            blob = await dataURLToBlob(url);
            filename = `data_${Date.now()}.${getFileExtension(blob.type)}`;
        } else {
            const response = await fetch(url);
            const contentType = response.headers.get('content-type');
            blob = await response.blob();
            filename = `file_${Date.now()}.${getFileExtension(contentType)}`;
        }

        const file = new File([blob], filename, { type: blob.type });
        const downloadUrl = URL.createObjectURL(file);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error('PegaTudo Error:', error);
        alert('Download failed. See console for details.');
    }
}

async function startRecording(stream, button) {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        return;
    }

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const filename = `recording_${Date.now()}.webm`;
        const file = new File([blob], filename, { type: blob.type });
        const url = URL.createObjectURL(file);

        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);

        button.textContent = 'Gravar Tela';
        button.classList.remove('recording');
        mediaRecorder = null;
    };

    mediaRecorder.start();
    button.textContent = 'Parar Gravação';
    button.classList.add('recording');
}

function addButtons(element) {
    if (processedElements.has(element) || !extensionEnabled) return;

    const shadowRoot = createButtonContainer(element);

    // Download button
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Baixar';
    downloadButton.className = 'pega-tudo-button';
    downloadButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDownload(element.src || element.href, element);
    };
    shadowRoot.appendChild(downloadButton);

    // Record button for videos
    if (element.tagName === 'VIDEO') {
        const recordButton = document.createElement('button');
        recordButton.textContent = 'Gravar Tela';
        recordButton.className = 'pega-tudo-button';
        recordButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            startRecording(stream, recordButton);
        };
        shadowRoot.appendChild(recordButton);
    }

    processedElements.add(element);
}

function run() {
    if (!extensionEnabled) return;

    document.querySelectorAll('video, img, audio, a').forEach(el => {
        const url = el.src || el.href;
        if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
            addButtons(el);
        }
    });

    // Special handling for YouTube
    if (window.location.hostname.includes('youtube.com')) {
        const video = document.querySelector('video');
        if (video && !processedElements.has(video)) {
            addButtons(video);
        }
    }
}
