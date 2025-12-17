export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  isLoading = true;
  // @ts-expect-error - pdfjs-dist/build/pdf.mjs doesn't have type definitions
  loadPromise = import("pdfjs-dist/build/pdf.mjs")
    .then((lib) => {
      if (typeof window !== "undefined") {
        lib.GlobalWorkerOptions.workerSrc = new URL(
          "/pdf.worker.min.mjs",
          window.location.origin
        ).toString();
      }
      pdfjsLib = lib;
      isLoading = false;
      return lib;
    })
    .catch((error) => {
      isLoading = false;
      loadPromise = null;
      throw new Error(`Failed to load PDF.js: ${error.message}`);
    });

  return loadPromise;
}

export async function convertPdfToImage(
  file: File
): Promise<PdfConversionResult> {
  try {
    const lib = await loadPdfJs();

    if (!lib || !lib.getDocument) {
      throw new Error("PDF.js library not properly loaded");
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = lib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    if (!pdf || pdf.numPages === 0) {
      throw new Error("PDF has no pages");
    }

    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Failed to get canvas context");
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    await page.render({ canvasContext: context, viewport }).promise;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const originalName = file.name.replace(/\.pdf$/i, "");
            const imageFile = new File([blob], `${originalName}.png`, {
              type: "image/png",
            });

            resolve({
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to create image blob from canvas",
            });
          }
        },
        "image/png",
        1.0
      );
    });
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error("PDF conversion error:", errorMessage, err);
    return {
      imageUrl: "",
      file: null,
      error: errorMessage,
    };
  }
}
