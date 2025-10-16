// TensorFlow.js tensor processing utilities

/**
 * Process segmentation tensor to ImageData for canvas rendering
 */
export const processTensorToImageData = async (
  tensor: any,
  width: number,
  height: number
): Promise<ImageData | null> => {
  try {
    console.log('[Segmentation] Processing tensor:', {
      shape: tensor.shape,
      dtype: tensor.dtype,
      targetSize: `${width}x${height}`
    });

    // Get raw tensor data as Float32Array
    const rawData = await tensor.data();
    console.log('[Segmentation] Raw data length:', rawData.length);

    // Create Uint8ClampedArray for ImageData (RGBA format)
    const imageDataArray = new Uint8ClampedArray(width * height * 4);

    const numPixels = width * height;
    
    // Process tensor data: R, G, B, A values are consecutive in the array
    for (let i = 0; i < numPixels; i++) {
      const r = rawData[i * 4];
      const g = rawData[i * 4 + 1];
      const b = rawData[i * 4 + 2];
      const a = rawData[i * 4 + 3];

      imageDataArray[i * 4] = r;
      imageDataArray[i * 4 + 1] = g;
      imageDataArray[i * 4 + 2] = b;
      imageDataArray[i * 4 + 3] = a;
    }

    // Create ImageData from processed array
    const imageData = new ImageData(imageDataArray, width, height);
    console.log('[Segmentation] ImageData created:', {
      width: imageData.width,
      height: imageData.height,
      dataLength: imageData.data.length
    });

    return imageData;
  } catch (err) {
    console.error('[Segmentation] Tensor processing error:', err);
    return null;
  }
};
