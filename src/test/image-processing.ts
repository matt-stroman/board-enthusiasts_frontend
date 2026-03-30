import { vi } from "vitest";

export function mockRasterImageProcessing(options: { width?: number; height?: number; blobSize?: number; blobType?: string } = {}) {
  const width = options.width ?? 400;
  const height = options.height ?? 400;
  const blobSize = options.blobSize ?? 2048;
  const blobType = options.blobType ?? "image/webp";
  const drawImage = vi.fn();
  const originalCreateElement = document.createElement.bind(document);
  const originalImage = globalThis.Image;

  class MockImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    naturalWidth = width;
    naturalHeight = height;
    width = width;
    height = height;

    set src(_value: string) {
      queueMicrotask(() => {
        this.onload?.();
      });
    }
  }

  const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, optionsArg?: ElementCreationOptions) => {
    if (tagName.toLowerCase() === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob: (callback: BlobCallback, requestedType?: string) => {
          callback(new Blob([new Uint8Array(blobSize)], { type: requestedType ?? blobType }));
        },
      } as unknown as HTMLCanvasElement;
    }

    return originalCreateElement(tagName, optionsArg);
  }) as typeof document.createElement);

  vi.stubGlobal("Image", MockImage as unknown as typeof Image);

  return {
    drawImage,
    restore() {
      createElementSpy.mockRestore();
      if (originalImage) {
        vi.stubGlobal("Image", originalImage);
      } else {
        vi.unstubAllGlobals();
      }
    },
  };
}
