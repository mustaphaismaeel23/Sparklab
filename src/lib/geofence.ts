const EARTH_RADIUS_METERS = 6_371_000;

function distanceInMeters(latitude1: number, longitude1: number, latitude2: number, longitude2: number) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const latitude1Radians = toRadians(latitude1);
  const latitude2Radians = toRadians(latitude2);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1Radians) * Math.cos(latitude2Radians) * Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
}

export function getGeofenceCheck({
  latitude,
  longitude,
  accuracy,
  centerLatitude,
  centerLongitude,
  radiusMeters
}: {
  latitude: number;
  longitude: number;
  accuracy: number;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
}) {
  const distanceMeters = distanceInMeters(latitude, longitude, centerLatitude, centerLongitude);
  const withinRadius = distanceMeters <= radiusMeters;
  const accuracyWithinLimit = accuracy <= radiusMeters;

  return {
    distanceMeters,
    withinRadius,
    accuracyWithinLimit,
    accepted: withinRadius && accuracyWithinLimit
  };
}

export function isWithinGeofence(input: Parameters<typeof getGeofenceCheck>[0]) {
  return getGeofenceCheck(input).accepted;
}
