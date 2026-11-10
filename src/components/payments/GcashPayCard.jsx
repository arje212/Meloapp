/**
 * What a customer sees when paying by GCash. The owner picks what is shown:
 *   mode "qr"     -> the QR code only (the personal mobile number stays private)
 *   mode "number" -> the mobile number
 * If the chosen option has not been filled in, the other one is shown so payment is never blocked.
 */
export function resolveGcash({ mode, number, qrUrl }) {
  const wantsQr = mode ? mode === 'qr' : !!qrUrl && !number; // old data without a mode: QR if that is all there is
  if (wantsQr && qrUrl) return 'qr';
  if (!wantsQr && number) return 'number';
  return qrUrl ? 'qr' : number ? 'number' : null;
}

export default function GcashPayCard({ mode, number, qrUrl, name, amountLabel = 'Amount', amount, className = '' }) {
  const shown = resolveGcash({ mode, number, qrUrl });
  if (!shown) return null;
  return (
    <div className={`bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl p-4 ${className}`}>
      <p className="text-xs font-medium opacity-80 mb-2">{shown === 'qr' ? 'Scan with the GCash app' : 'Send payment to'}</p>
      {shown === 'qr' ? (
        <img src={qrUrl} alt="GCash QR code" className="mx-auto w-52 max-w-full rounded-xl bg-white p-2" />
      ) : (
        <p className="text-2xl font-bold tracking-widest">{number}</p>
      )}
      {name && <p className={`text-sm opacity-90 mt-1 ${shown === 'qr' ? 'text-center' : ''}`}>{name}</p>}
      {amount != null && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-xs opacity-80">{amountLabel}</p>
          <p className="text-xl font-bold">₱{Number(amount).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
