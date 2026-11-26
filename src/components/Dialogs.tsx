// Globalne okienka: krótkie powiadomienia (toast) oraz pytania z przyciskami (zamiast window.confirm,
// który w trybie aplikacji na iPhonie wygląda słabo).
import { useEffect, useState } from 'react';

type Variant = 'primary' | 'danger' | 'ghost' | 'blue';
interface AskOption<T> { label: string; value: T; variant?: Variant }
interface AskRequest { title: string; message?: string; options: AskOption<unknown>[]; resolve: (v: unknown) => void }

export interface ToastAction { label: string; onClick: () => void }
let pushToast: ((msg: string, action?: ToastAction) => void) | null = null;
let pushAsk: ((req: AskRequest) => void) | null = null;

/** Krótkie powiadomienie. Z akcją (np. „Cofnij”) zostaje dłużej i da się je stuknąć. */
export function toast(msg: string, action?: ToastAction) {
  pushToast?.(msg, action);
}

/** Pokazuje pytanie z przyciskami. Zwraca wartość wybranej opcji albo null (anulowano). */
export function ask<T>(title: string, message: string | undefined, options: AskOption<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    pushAsk?.({ title, message, options: options as AskOption<unknown>[], resolve: resolve as (v: unknown) => void });
  });
}

export const confirmBox = (title: string, message: string, confirmLabel = 'Tak', danger = false) =>
  ask(title, message, [{ label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary' }]).then((v) => v === true);

export function DialogHost() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; action?: ToastAction }[]>([]);
  const [req, setReq] = useState<AskRequest | null>(null);

  useEffect(() => {
    pushToast = (msg, action) => {
      const id = Date.now() + Math.random();
      // Nowe „Cofnij” zastępuje poprzednie — cofnąć można ostatnią zmianę.
      setToasts((t) => [...(action ? t.filter((x) => !x.action) : t), { id, msg, action }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5000 : 2600);
    };
    // Nowe pytanie zastępuje poprzednie — poprzednie traktujemy jako anulowane.
    pushAsk = (next) =>
      setReq((prev) => {
        prev?.resolve(null);
        return next;
      });
    return () => {
      pushToast = null;
      pushAsk = null;
    };
  }, []);

  const answer = (v: unknown) => {
    req?.resolve(v);
    setReq(null);
  };

  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.action ? 'has-action' : ''}`}>
            <span>{t.msg}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                  t.action!.onClick();
                }}
              >
                ↩️ {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      {req && (
        <div className="dialog-root">
          <div className="sheet-backdrop" onClick={() => answer(null)} />
          <div className="dialog" role="alertdialog" aria-modal="true">
            <h3>{req.title}</h3>
            {req.message && <p>{req.message}</p>}
            <div className="dialog-actions">
              {req.options.map((o) => (
                <button key={o.label} className={`btn btn-${o.variant ?? 'primary'}`} onClick={() => answer(o.value)}>
                  {o.label}
                </button>
              ))}
              <button className="btn btn-ghost" onClick={() => answer(null)}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
