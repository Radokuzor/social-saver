import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadMedia(
    file: { uri: string; type: string },
    userId: string
): Promise<string> {
    try {
        const response = await fetch(file.uri);
        const blob = await response.blob();

        const timestamp = Date.now();
        const filename = `${userId}/${timestamp}.${file.type.split('/')[1]}`;
        const storageRef = ref(storage, `media/${filename}`);

        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);

        return downloadUrl;
    } catch (error) {
        console.error('Media upload failed:', error);
        throw new Error('Failed to upload media');
    }
}

export async function uploadRemoteImageToStorage(
    remoteUrl: string,
    userId: string
): Promise<string | null> {
    try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status}`);
        }
        const blob = await response.blob();
        const contentType = blob.type || 'image/jpeg';
        const extension =
            contentType.split('/')[1] ||
            remoteUrl.split('.').pop()?.split(/\#|\?/)[0] ||
            'jpg';

        const timestamp = Date.now();
        const filename = `${userId}/${timestamp}-thumb.${extension}`;
        const storageRef = ref(storage, `media/${filename}`);

        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error) {
        console.warn('Remote thumbnail upload failed:', error);
        return null;
    }
}

// Convert image to base64 for AI analysis
export async function imageToBase64(uri: string): Promise<string> {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Base64 conversion failed:', error);
        throw error;
    }
}
