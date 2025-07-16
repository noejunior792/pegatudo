// PegaTudo - Toast Service

function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'pega-tudo-toast';
  toast.textContent = message;
  
  // Adiciona o toast ao corpo do documento (da popup)
  document.body.appendChild(toast);

  // Anima a entrada
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  // Anima a saída e remove o elemento
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 500);
  }, duration);
}