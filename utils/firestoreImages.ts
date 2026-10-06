import * as ImageManipulator from 'expo-image-manipulator';

export const MAX_PROFILE_IMAGE_LENGTH = 180_000;
export const MAX_CHAT_IMAGE_LENGTH = 400_000;

export async function prepareImageForFirestore(
  uri: string,
  width: number,
  height: number,
  maxDataUriLength: number
): Promise<string> {
  const maxDimensions = [768, 640, 512, 384];
  const qualities = [0.65, 0.5, 0.35];

  for (const maxDimension of maxDimensions) {
    const resize = width >= height
      ? { width: maxDimension }
      : { height: maxDimension };

    for (const compress of qualities) {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize }],
        { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (result.base64) {
        const dataUri = `data:image/jpeg;base64,${result.base64}`;
        if (dataUri.length <= maxDataUriLength) {
          return dataUri;
        }
      }
    }
  }

  throw new Error('This image is too large to save in the database. Choose a smaller image.');
}
