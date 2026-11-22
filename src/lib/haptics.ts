// "Haptyka" na iPhonie. Safari nie obsługuje navigator.vibrate, ale od iOS 18
// kliknięcie przełącznika <input type="checkbox" switch> daje delikatne stuknięcie.
// Na Androidzie używamy zwykłej wibracji.

let label: HTMLLabelElement | null = null;

export function haptic() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
      return;
    }
    if (!label) {
      label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.body.appendChild(label);
    }
    label.click();
  } catch {
    /* brak haptyki na tym urządzeniu — trudno */
  }
}
