import React, { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import type { PolicePin } from "~/services/location-service";
import styles from "./nearest-police.module.css";

interface NearestPoliceProps {
  currentUserLocation: { latitude: number; longitude: number } | null;
  policePins: PolicePin[];
}

export function NearestPolice({ currentUserLocation, policePins }: NearestPoliceProps) {
  const [streetName, setStreetName] = useState<string>("");
  const [distance, setDistance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentUserLocation || policePins.length === 0) {
      setStreetName("");
      setDistance(null);
      return;
    }

    // Find nearest police pin
    let nearestPin = policePins[0];
    let minDistance = calculateDistance(
      currentUserLocation.latitude,
      currentUserLocation.longitude,
      nearestPin.latitude,
      nearestPin.longitude
    );

    for (let i = 1; i < policePins.length; i++) {
      const dist = calculateDistance(
        currentUserLocation.latitude,
        currentUserLocation.longitude,
        policePins[i].latitude,
        policePins[i].longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestPin = policePins[i];
      }
    }

    setDistance(minDistance);

    // Fetch street name using reverse geocoding
    setIsLoading(true);
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${nearestPin.latitude}&lon=${nearestPin.longitude}&zoom=18&addressdetails=1`
    )
      .then((res) => res.json())
      .then((data) => {
        const address = data.address;
        const street = address?.road || address?.street || address?.neighbourhood || "Unknown location";
        setStreetName(street);
        setIsLoading(false);
      })
      .catch(() => {
        setStreetName("Unable to fetch street name");
        setIsLoading(false);
      });
  }, [currentUserLocation, policePins]);

  if (!currentUserLocation || policePins.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <MapPin size={16} />
      </div>
      <div className={styles.content}>
        <div className={styles.street}>
          {isLoading ? "Loading..." : streetName}
        </div>
        <div className={styles.distance}>
          {distance !== null && `${formatDistance(distance)} away`}
        </div>
      </div>
    </div>
  );
}

// Calculate distance between two coordinates in meters using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Format distance for display
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(1)} km`;
  }
}
