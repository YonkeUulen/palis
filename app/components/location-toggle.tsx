import React from "react";
import { MapPin, MapPinOff } from "lucide-react";
import styles from "./location-toggle.module.css";

interface LocationToggleProps {
  isSharing: boolean;
  onToggle: () => void;
  className?: string;
}

export function LocationToggle({ isSharing, onToggle, className }: LocationToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`${styles.toggleButton} ${isSharing ? styles.active : styles.inactive} ${className || ""}`}
      aria-label={isSharing ? "Stop sharing location" : "Start sharing location"}
    >
      {isSharing ? <MapPin className={styles.icon} /> : <MapPinOff className={styles.icon} />}
    </button>
  );
}
