import { migrationMediaUploadPolicies } from "@board-enthusiasts/migration-contract";
import { afterEach, describe, expect, it } from "vitest";
import { formatMediaUploadGuidance, normalizeImageUpload } from "./media-upload";
import { mockRasterImageProcessing } from "./test/image-processing";

describe("media upload helpers", () => {
  let restoreImageProcessing: (() => void) | null = null;

  afterEach(() => {
    restoreImageProcessing?.();
    restoreImageProcessing = null;
  });

  it("formats shared upload guidance from the maintained media policy", () => {
    expect(formatMediaUploadGuidance(migrationMediaUploadPolicies.avatars, { optional: true })).toBe(
      "Optional. Recommended 512 x 512 px. Max 256 KB.",
    );
    expect(formatMediaUploadGuidance(migrationMediaUploadPolicies.logoImages, { optional: true })).toBe(
      "Optional. Recommended raster size 1200 x 400 px. SVG also supported. Max 256 KB.",
    );
  });

  it("normalizes oversized raster dimensions before upload", async () => {
    const mocked = mockRasterImageProcessing({ width: 2400, height: 1200, blobSize: 4096, blobType: "image/webp" });
    restoreImageProcessing = mocked.restore;

    const upload = await normalizeImageUpload(
      new File([new Uint8Array(16)], "hero.png", { type: "image/png" }),
      migrationMediaUploadPolicies.heroImages,
      {
        label: "hero image",
        readErrorMessage: "Hero upload could not be read.",
      },
    );

    expect(mocked.drawImage).toHaveBeenCalled();
    expect(upload.file.type).toBe("image/webp");
    expect(upload.file.name).toBe("hero.webp");
    expect(upload.width).toBe(1600);
    expect(upload.height).toBe(800);
    expect(upload.dataUrl).toMatch(/^data:image\/webp/);
  });

  it("reduces oversized raster files instead of rejecting them immediately", async () => {
    const mocked = mockRasterImageProcessing({ width: 900, height: 1280, blobSize: 2048, blobType: "image/webp" });
    restoreImageProcessing = mocked.restore;

    const upload = await normalizeImageUpload(
      new File([new Uint8Array(1536 * 1024 + 256)], "card.png", { type: "image/png" }),
      migrationMediaUploadPolicies.cardImages,
      {
        label: "card image",
        readErrorMessage: "Card image upload could not be read.",
      },
    );

    expect(mocked.drawImage).toHaveBeenCalled();
    expect(upload.file.type).toBe("image/webp");
    expect(upload.file.name).toBe("card.webp");
  });

  it("still rejects oversized svg uploads that cannot be locally reduced", async () => {
    await expect(
      normalizeImageUpload(
        new File([new Uint8Array(256 * 1024 + 1)], "logo.svg", { type: "image/svg+xml" }),
        migrationMediaUploadPolicies.logoImages,
        {
          label: "studio logo image",
          readErrorMessage: "Studio media upload could not be read.",
        },
      ),
    ).rejects.toThrow("Uploaded studio logo image must be 256 KB or smaller.");
  });
});
