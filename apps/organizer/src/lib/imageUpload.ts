/**
 * Prepara a foto escolhida para o envio: reduz para no maximo 1600 px no lado maior e
 * recodifica (WebP; JPEG se o navegador nao gerar WebP). Isso tira o peso de fotos de
 * celular e remove os metadados (EXIF/localizacao) do arquivo enviado.
 */
export const MAX_SIDE = 1600;
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export interface PreparedImage {
  readonly contentType: 'image/webp' | 'image/jpeg';
  readonly dataBase64: string;
}

export class ImageError extends Error {}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImageError('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const texto = String(reader.result);
      resolve(texto.slice(texto.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!/^image\/(jpeg|png|webp|heic|heif|gif|bmp)$/i.test(file.type)) {
    throw new ImageError('Escolha uma foto em JPG, PNG ou WebP.');
  }
  if (file.size > MAX_ORIGINAL_BYTES) throw new ImageError('A foto é grande demais (máximo de 15 MB).');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('Não foi possível abrir esta imagem. Tente um JPG ou PNG.');
  }
  const escala = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Este navegador não consegue preparar a imagem.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const [type, qualidade] of [
    ['image/webp', 0.86],
    ['image/webp', 0.7],
    ['image/jpeg', 0.8],
    ['image/jpeg', 0.6],
  ] as const) {
    const blob = await toBlob(canvas, type, qualidade);
    if (blob && blob.type === type && blob.size <= MAX_UPLOAD_BYTES) {
      return { contentType: type, dataBase64: await blobToBase64(blob) };
    }
  }
  throw new ImageError('A imagem continua grande demais depois de reduzida. Escolha outra.');
}
