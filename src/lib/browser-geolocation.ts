'use client';

export function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support location access.'));
      return;
    }

    let bestPosition: GeolocationPosition | undefined;
    let watchId: number | undefined;
    let timerId: number | undefined;
    let settled = false;
    const finish = (position?: GeolocationPosition, error?: Error) => {
      if (settled) return;
      settled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (position) resolve(position);
      else reject(error ?? new Error('Location request timed out. Try again near a window or outdoors.'));
    };

    timerId = window.setTimeout(() => finish(bestPosition), 20_000);
    watchId = navigator.geolocation.watchPosition(position => {
      if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
        bestPosition = position;
      }
      if (position.coords.accuracy <= 25) finish(position);
    }, error => {
      if (error.code === error.PERMISSION_DENIED) {
        finish(undefined, new Error('Allow precise location access to record attendance.'));
      } else if (bestPosition) {
        finish(bestPosition);
      } else if (error.code === error.TIMEOUT) {
        finish(undefined, new Error('Location request timed out. Try again near a window or outdoors.'));
      } else {
        finish(undefined, new Error('Unable to determine your location. Turn on precise location and try again.'));
      }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 });
  });
}
