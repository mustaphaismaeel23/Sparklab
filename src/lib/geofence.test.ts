import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { getGeofenceCheck, isWithinGeofence } from './geofence';

const office = { latitude: 10, longitude: 20 };

test('accepts a precise location inside the office radius', () => {
  equal(isWithinGeofence({
    latitude: office.latitude + 0.0004,
    longitude: office.longitude,
    accuracy: 10,
    centerLatitude: office.latitude,
    centerLongitude: office.longitude,
    radiusMeters: 100
  }), true);
});

test('rejects a location outside the office radius', () => {
  equal(isWithinGeofence({
    latitude: office.latitude + 0.001,
    longitude: office.longitude,
    accuracy: 0,
    centerLatitude: office.latitude,
    centerLongitude: office.longitude,
    radiusMeters: 100
  }), false);
});

test('accepts a reported point inside the radius when GPS uncertainty overlaps the edge', () => {
  equal(isWithinGeofence({
    latitude: office.latitude + 0.0008,
    longitude: office.longitude,
    accuracy: 20,
    centerLatitude: office.latitude,
    centerLongitude: office.longitude,
    radiusMeters: 100
  }), true);
});

test('rejects an imprecise location even when its reported point is at the office', () => {
  equal(isWithinGeofence({
    latitude: office.latitude,
    longitude: office.longitude,
    accuracy: 101,
    centerLatitude: office.latitude,
    centerLongitude: office.longitude,
    radiusMeters: 100
  }), false);
});

test('mapped hub pin is within 10 meters of the configured office entrance pin', () => {
  const check = getGeofenceCheck({
    latitude: 11.9760354,
    longitude: 8.544282,
    accuracy: 10,
    centerLatitude: 11.97598,
    centerLongitude: 8.54431,
    radiusMeters: 100
  });

  equal(check.accepted, true);
  equal(check.distanceMeters < 10, true);
});

test('reports an outside GPS point separately from its accuracy', () => {
  const check = getGeofenceCheck({
    latitude: office.latitude + 0.0063,
    longitude: office.longitude,
    accuracy: 20,
    centerLatitude: office.latitude,
    centerLongitude: office.longitude,
    radiusMeters: 100
  });

  equal(check.withinRadius, false);
  equal(check.accuracyWithinLimit, true);
  equal(check.accepted, false);
  equal(check.distanceMeters > 600 && check.distanceMeters < 800, true);
});

test('checks attendance relative to the location captured for the QR session', () => {
  const sessionLocation = { latitude: 12, longitude: 8.6 };
  const check = getGeofenceCheck({
    latitude: sessionLocation.latitude + 0.0004,
    longitude: sessionLocation.longitude,
    accuracy: 10,
    centerLatitude: sessionLocation.latitude,
    centerLongitude: sessionLocation.longitude,
    radiusMeters: 100
  });

  equal(check.accepted, true);
  equal(check.distanceMeters < 100, true);
});
