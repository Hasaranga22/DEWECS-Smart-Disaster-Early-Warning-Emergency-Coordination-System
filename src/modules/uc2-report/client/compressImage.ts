const MAX_IMAGE_BYTES = 200 * 1024;

/** Produces a bounded data URL so report uploads remain small and reliable. */
export async function compressImage(file: File, maxWidth = 960, quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const render = (nextWidth: number, nextHeight: number, nextQuality: number) => {
          canvas.width = nextWidth;
          canvas.height = nextHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, nextWidth, nextHeight);
          const dataUrl = canvas.toDataURL('image/jpeg', nextQuality);
          const byteSize = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
          if (byteSize <= MAX_IMAGE_BYTES || nextWidth <= 320) {
            resolve(dataUrl);
            return;
          }

          render(
            Math.max(320, Math.round(nextWidth * 0.8)),
            Math.max(320, Math.round(nextHeight * 0.8)),
            Math.max(0.45, nextQuality - 0.08)
          );
        };

        render(width, height, quality);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
