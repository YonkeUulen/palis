// In-memory storage for user locations and police pins
// In production, this should be replaced with a database

export interface UserLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: Date;
}

export interface PolicePin {
  id: string;
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

// Store active locations in memory
const activeLocations = new Map<string, UserLocation>();
const policePins = new Map<string, PolicePin>();

// Clean up stale locations (older than 30 seconds - user inactive)
const STALE_THRESHOLD = 30 * 1000;
// Police pins stay for 20 minutes regardless of user activity
const POLICE_PIN_THRESHOLD = 20 * 60 * 1000;

function cleanStaleLocations() {
  const now = new Date().getTime();
  for (const [id, location] of activeLocations.entries()) {
    if (now - location.lastUpdated.getTime() > STALE_THRESHOLD) {
      activeLocations.delete(id);
    }
  }
}

function cleanStalePolicePins() {
  const now = new Date().getTime();
  for (const [id, pin] of policePins.entries()) {
    if (now - pin.createdAt.getTime() > POLICE_PIN_THRESHOLD) {
      policePins.delete(id);
    }
  }
}

// Calculate distance between two coordinates in meters using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function updateLocation(userId: string, latitude: number, longitude: number, name?: string) {
  cleanStaleLocations();
  
  activeLocations.set(userId, {
    id: userId,
    name: name || `User ${userId.slice(0, 4)}`,
    latitude,
    longitude,
    lastUpdated: new Date(),
  });
  
  return { success: true };
}

export function removeLocation(userId: string) {
  activeLocations.delete(userId);
  return { success: true };
}

export function getAllLocations(): UserLocation[] {
  cleanStaleLocations();
  return Array.from(activeLocations.values());
}

export function getLocationCount(): number {
  cleanStaleLocations();
  return activeLocations.size;
}

export function addPolicePin(userId: string, userName: string, latitude: number, longitude: number) {
  cleanStalePolicePins();
  
  // Check if user already has pins within 100 meters
  for (const pin of policePins.values()) {
    if (pin.userId === userId) {
      const distance = calculateDistance(pin.latitude, pin.longitude, latitude, longitude);
      if (distance < 100) {
        return { success: false, error: "Cannot place pin within 100 meters of your existing pins" };
      }
    }
  }
  
  const pinId = `${userId}-${Date.now()}`;
  policePins.set(pinId, {
    id: pinId,
    userId,
    userName,
    latitude,
    longitude,
    createdAt: new Date(),
  });
  
  return { success: true };
}

export function getAllPolicePins(): PolicePin[] {
  cleanStalePolicePins();
  return Array.from(policePins.values());
}
