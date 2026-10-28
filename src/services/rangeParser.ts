export interface ParsedRange {
  start: number;
  end: number;
  totalSize: number;
  chunkLength: number;
  contentRangeHeader: string;
}

export function parseByteRange(rangeHeader: string | undefined, totalSize: number): ParsedRange | null {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
  const rawStart = rangeParts[0];
  const rawEnd = rangeParts[1];

  let start: number;
  let end: number;

  if (rawStart === '' && rawEnd !== '') {
    const suffix = parseInt(rawEnd, 10);
    if (isNaN(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else if (rawStart !== '' && rawEnd === '') {
    start = parseInt(rawStart, 10);
    if (isNaN(start) || start < 0 || start >= totalSize) return null;
    end = totalSize - 1;
  } else if (rawStart !== '' && rawEnd !== '') {
    start = parseInt(rawStart, 10);
    end = parseInt(rawEnd, 10);
    if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= totalSize) {
      return null;
    }
    end = Math.min(end, totalSize - 1);
  } else {
    return null;
  }

  const chunkLength = end - start + 1;
  const contentRangeHeader = `bytes ${start}-${end}/${totalSize}`;

  return {
    start,
    end,
    totalSize,
    chunkLength,
    contentRangeHeader,
  };
}
