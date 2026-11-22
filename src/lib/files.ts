// Zapisywanie plików na iPhonie: Safari obsługuje <a download>, a w trybie aplikacji
// (z ekranu początkowego) często lepiej działa systemowy arkusz "Udostępnij".

export async function saveFile(blob: Blob, filename: string, preferShare: boolean) {
  const file = new File([blob], filename, { type: blob.type });
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // Użytkownik anulował udostępnianie — nic nie robimy.
      if ((err as Error).name === 'AbortError') return;
      // Inny błąd → próbujemy zwykłego pobierania poniżej.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
