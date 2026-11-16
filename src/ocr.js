// Free on-device OCR. Tesseract.js and the Korean model load from jsDelivr on first use, then the browser caches them.
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js'

export async function recognize(files, onProgress = () => {}) {
  const mod = await import(TESSERACT)
  const createWorker = mod.createWorker || mod.default?.createWorker
  let fileIndex = 0
  const worker = await createWorker('kor+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress((fileIndex + m.progress) / files.length)
      else if (fileIndex === 0) onProgress(0.02)
    },
  })
  const texts = []
  try {
    for (; fileIndex < files.length; fileIndex++) {
      const { data } = await worker.recognize(files[fileIndex])
      texts.push(data.text)
    }
  } finally {
    await worker.terminate()
  }
  onProgress(1)
  return texts
}
