import qrcodeFactory from './qrcode-core';

type Matrix = boolean[][];

const DEFAULT_ERROR_CORRECTION: 'L' | 'M' | 'Q' | 'H' = 'M';

function buildQrMatrix(data: string, errorCorrection: 'L' | 'M' | 'Q' | 'H'): Matrix {
  const qr = qrcodeFactory(0, errorCorrection);
  qr.addData(data);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const matrix: Matrix = [];

  for (let row = 0; row < moduleCount; row += 1) {
    matrix[row] = [];
    for (let col = 0; col < moduleCount; col += 1) {
      matrix[row][col] = !!qr.isDark(row, col);
    }
  }

  return matrix;
}

export function generateQrMatrix(
  data: string,
  errorCorrection: 'L' | 'M' | 'Q' | 'H' = DEFAULT_ERROR_CORRECTION
): Matrix {
  const text = (data || 'fy').trim();
  return buildQrMatrix(text, errorCorrection);
}

export function generateQrSvg(
  data: string,
  size: number = 60,
  errorCorrection: 'L' | 'M' | 'Q' | 'H' = DEFAULT_ERROR_CORRECTION
): string {
  const matrix = generateQrMatrix(data, errorCorrection);
  const moduleCount = matrix.length;
  const moduleSize = size / moduleCount;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += '<rect width="100%" height="100%" fill="white"/>';

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!matrix[row][col]) continue;
      const x = (col * moduleSize).toFixed(3);
      const y = (row * moduleSize).toFixed(3);
      const dimension = moduleSize.toFixed(3);
      svg += `<rect x="${x}" y="${y}" width="${dimension}" height="${dimension}" fill="black"/>`;
    }
  }

  svg += '</svg>';
  return svg;
}
