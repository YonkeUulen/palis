import React, { useEffect, useRef } from "react";
import type { UserLocation, PolicePin } from "~/services/location-service";
import styles from "./location-map.module.css";

interface LocationMapProps {
  users: UserLocation[];
  policePins: PolicePin[];
  currentUserLocation: { latitude: number; longitude: number } | null;
  currentUserName?: string;
  className?: string;
}

export function LocationMap({ users, policePins, currentUserLocation, currentUserName, className }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const hasInitializedRef = useRef(false);
  
  // Listen for zoom events
  useEffect(() => {
    const handleZoom = (event: CustomEvent) => {
      if (mapInstanceRef.current) {
        const { latitude, longitude, zoom } = event.detail;
        mapInstanceRef.current.setView([latitude, longitude], zoom, {
          animate: true,
          duration: 1
        });
      }
    };
    
    window.addEventListener('zoom-to-location', handleZoom as EventListener);
    return () => window.removeEventListener('zoom-to-location', handleZoom as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Fix for default marker icons in Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapInstanceRef.current && mapRef.current) {
        const map = L.map(mapRef.current).setView([40.7589, -73.9851], 14);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when users, pins, or current location changes
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined") return;

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      // Create custom icon for other users
      const userIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: var(--color-marker);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Add markers for other users
      users.forEach((user) => {
        const marker = L.marker([user.latitude, user.longitude], { icon: userIcon }).addTo(mapInstanceRef.current);

        const timeAgo = getTimeAgo(user.lastUpdated);
        marker.bindPopup(`
          <div class="${styles.markerPopup}">
            <div class="${styles.markerName}">${user.name}</div>
            <div class="${styles.markerTime}">Updated ${timeAgo}</div>
          </div>
        `);

        markersRef.current.push(marker);
      });

      // Add police pin markers
      policePins.forEach((pin) => {
        const policeIcon = L.divIcon({
          className: "police-marker",
          html: `<div style="
            width: 36px;
            height: 36px;
            background-color: var(--color-error-9);
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 3px 12px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          ">👮</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([pin.latitude, pin.longitude], { icon: policeIcon }).addTo(mapInstanceRef.current);

        const timeAgo = getTimeAgo(pin.createdAt);
        marker.bindPopup(`
          <div class="${styles.markerPopup}">
            <div class="${styles.markerName}">Police Alert</div>
            <div class="${styles.markerTime}">${timeAgo}</div>
          </div>
        `);

        markersRef.current.push(marker);
      });

      // Add marker for current user if sharing location
      if (currentUserLocation) {
        const currentUserIcon = L.divIcon({
          className: "current-user-marker",
          html: `<div style="
            width: 28px;
            height: 28px;
            background-color: var(--color-accent-9);
            border: 4px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 12px rgba(0,0,0,0.4);
            animation: pulse 2s infinite;
          "></div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
            }
          </style>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const currentMarker = L.marker([currentUserLocation.latitude, currentUserLocation.longitude], {
          icon: currentUserIcon,
        }).addTo(mapInstanceRef.current);

        currentMarker.bindPopup(`
          <div class="${styles.markerPopup}">
            <div class="${styles.markerName}">${currentUserName || "You"}</div>
            <div class="${styles.markerTime}">Your current location</div>
          </div>
        `);

        markersRef.current.push(currentMarker);

        // Center map on current user only on first initialization
        if (!hasInitializedRef.current) {
          mapInstanceRef.current.setView([currentUserLocation.latitude, currentUserLocation.longitude], 14);
          hasInitializedRef.current = true;
        }
      }
    };

    updateMarkers();
  }, [users, policePins, currentUserLocation, currentUserName]);

  return <div ref={mapRef} className={`${styles.mapContainer} ${className || ""}`} />;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 120) return "1 minute ago";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 7200) return "1 hour ago";
  return `${Math.floor(seconds / 3600)} hours ago`;
}
