import type { MigrationMediaUploadPolicy } from "@board-enthusiasts/migration-contract";

const SVG_MIME_TYPE = "image/svg+xml";
const NORMALIZED_RASTER_MIME_TYPE = "image/webp";
const WEBP_QUALITY_STEPS = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52] as const;

export type NormalizedImageUpload = {
  file: File;
  dataUrl: string;
  fileName: string;
  width: number | null;
  height: number | null;
};

function replaceFileExtension(fileName: string, extension: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return `upload${extension}`;
  }

  return trimmed.includes(".") ? trimmed.replace(/\.[^.]+$/, extension) : `${trimmed}${extension}`;
}

function readFileAsDataUrl(file: Blob, readErrorMessage: string): Promise<string> {
  const reader = new FileReader();

  return new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(readErrorMessage));
    reader.readAsDataURL(file);
  });
}

function loadRasterImage(dataUrl: string, readErrorMessage: string): Promise<{ image: HTMLImageElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width <= 0 || height <= 0) {
        reject(new Error(readErrorMessage));
        return;
      }

      resolve({ image, width, height });
    };
    image.onerror = () => reject(new Error(readErrorMessage));
    image.src = dataUrl;
  });
}

function fitWithinBounds(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function renderCanvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Image upload could not be processed."));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}

async function normalizeRasterImage(
  file: File,
  policy: MigrationMediaUploadPolicy,
  options: { label: string; readErrorMessage: string },
): Promise<NormalizedImageUpload> {
  const sourceDataUrl = await readFileAsDataUrl(file, options.readErrorMessage);
  const { image, width: sourceWidth, height: sourceHeight } = await loadRasterImage(sourceDataUrl, options.readErrorMessage);
  const outputDimensions = fitWithinBounds(sourceWidth, sourceHeight, policy.recommendedWidth, policy.recommendedHeight);
  const needsResize = outputDimensions.width !== sourceWidth || outputDimensions.height !== sourceHeight;
  const needsReencode = needsResize || file.type !== NORMALIZED_RASTER_MIME_TYPE || file.size > policy.maxUploadBytes;

  if (!needsReencode) {
    return {
      file,
      dataUrl: sourceDataUrl,
      fileName: file.name,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputDimensions.width;
  canvas.height = outputDimensions.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image upload could not be processed.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let normalizedBlob: Blob | null = null;
  for (const quality of WEBP_QUALITY_STEPS) {
    const candidate = await renderCanvasToBlob(canvas, NORMALIZED_RASTER_MIME_TYPE, quality);
    normalizedBlob = candidate;
    if (candidate.size <= policy.maxUploadBytes) {
      break;
    }
  }

  if (!normalizedBlob) {
    throw new Error("Image upload could not be processed.");
  }

  if (normalizedBlob.size > policy.maxUploadBytes) {
    throw new Error(buildUploadSizeError(options.label, policy));
  }

  const normalizedFile = new File([normalizedBlob], replaceFileExtension(file.name, ".webp"), {
    type: NORMALIZED_RASTER_MIME_TYPE,
    lastModified: Date.now(),
  });

  const normalizedDataUrl = await readFileAsDataUrl(normalizedFile, options.readErrorMessage);
  return {
    file: normalizedFile,
    dataUrl: normalizedDataUrl,
    fileName: normalizedFile.name,
    width: outputDimensions.width,
    height: outputDimensions.height,
  };
}

export function formatAcceptedMimeTypes(mimeTypes: readonly string[]): string {
  return mimeTypes
    .map((mimeType) => {
      switch (mimeType) {
        case "image/jpeg":
          return "JPEG";
        case "image/png":
          return "PNG";
        case "image/webp":
          return "WEBP";
        case "image/svg+xml":
          return "SVG";
        default:
          return mimeType;
      }
    })
    .join(", ");
}

export function formatBinaryFileSize(bytes: number): string {
  if (bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

export function formatRecommendedResolution(policy: Pick<MigrationMediaUploadPolicy, "recommendedWidth" | "recommendedHeight">): string {
  return `${policy.recommendedWidth} x ${policy.recommendedHeight} px`;
}

export function formatMediaUploadGuidance(
  policy: MigrationMediaUploadPolicy,
  options: { optional?: boolean } = {},
): string {
  const guidance: string[] = [];
  if (options.optional) {
    guidance.push("Optional.");
  }
  if (policy.acceptedMimeTypes.includes(SVG_MIME_TYPE)) {
    guidance.push(`Recommended raster size ${formatRecommendedResolution(policy)}.`);
    guidance.push("SVG also supported.");
  } else {
    guidance.push(`Recommended ${formatRecommendedResolution(policy)}.`);
  }
  guidance.push(`Max ${formatBinaryFileSize(policy.maxUploadBytes)}.`);
  return guidance.join(" ");
}

export function buildAcceptedMimeTypeError(label: string, policy: Pick<MigrationMediaUploadPolicy, "acceptedMimeTypes">): string {
  return `Uploaded ${label} must be ${formatAcceptedMimeTypes(policy.acceptedMimeTypes)}.`;
}

export function buildUploadSizeError(label: string, policy: Pick<MigrationMediaUploadPolicy, "maxUploadBytes">): string {
  return `Uploaded ${label} must be ${formatBinaryFileSize(policy.maxUploadBytes)} or smaller.`;
}

export async function normalizeImageUpload(
  file: File,
  policy: MigrationMediaUploadPolicy,
  options: { label: string; readErrorMessage: string },
): Promise<NormalizedImageUpload> {
  if (!policy.acceptedMimeTypes.some((mimeType) => mimeType === file.type)) {
    throw new Error(buildAcceptedMimeTypeError(options.label, policy));
  }

  if (file.type === SVG_MIME_TYPE) {
    if (file.size > policy.maxUploadBytes) {
      throw new Error(buildUploadSizeError(options.label, policy));
    }

    return {
      file,
      dataUrl: await readFileAsDataUrl(file, options.readErrorMessage),
      fileName: file.name,
      width: null,
      height: null,
    };
  }

  const normalized = await normalizeRasterImage(file, policy, options);
  return normalized;
}
