import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { isWithinGeofence } from './geofence';

const office = { latitude: 10, longitude: 20 };

test('accepts a precise location inside the office radius', () => {
  equal(isWithinGeofence({
    latitude: office.latitude + 0.0004,
    longitude: office.longitude,
    accuracy: 10,
    officeLatitude: office.latitude,
    officeLongitude: office.longitude,
    radiusMeters: 100
  }), true);
});

test('rejects a location outside the office radius', () => {
  equal(isWithinGeofence({
    latitude: office.latitude + 0.001,
    longitude: office.longitude,
    accuracy: 0,
    officeLatitude: office.latitude,
    officeLongitude: office.longitude,
    radiusMeters: 100
  }), false);
});

test('rejects a location whose reported uncertainty crosses the radius', () => {
  equal(isWithinGeofence({
    latitude: office.latitude + 0.0008,
    longitude: office.longitude,
    accuracy: 20,
    officeLatitude: office.latitude,
    officeLongitude: office.longitude,
    radiusMeters: 100
  }), false);
});
