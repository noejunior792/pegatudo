function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'pega-tudo-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500);
    }, duration);
}
