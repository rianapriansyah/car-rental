import QRCode from 'qrcode'

/** PNG data URL suitable for jsPDF `addImage` and print HTML `<img src>`. */
export async function generateReceiptQrDataUrl(verificationUrl: string): Promise<string | undefined> {
  const url = verificationUrl.trim()
  if (!url) return undefined
  try {
    return await QRCode.toDataURL(url, { margin: 1, width: 200, errorCorrectionLevel: 'M' })
  } catch {
    return undefined
  }
}
