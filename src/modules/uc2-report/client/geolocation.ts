export interface GeoResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  requiresManualPin: boolean;
}

export async function getCurrentLocation(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy,
          // Business Rule: GPS accuracy > 100m -> manual pin required
          requiresManualPin: accuracy > 100, 
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
