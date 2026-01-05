import React, { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { Users, ShieldAlert } from "lucide-react";
import { LocationMap } from "~/components/location-map";
import { LocationToggle } from "~/components/location-toggle";
import { NearestPolice } from "~/components/nearest-police";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import type { UserLocation, PolicePin } from "~/services/location-service";
import { toast } from "~/hooks/use-toast";
import { useFetcher } from "react-router";
import styles from "./home.module.css";

const POSITION_UPDATE_INTERVAL = 10000; // 10 seconds - update current position
const MAP_POLL_INTERVAL = 10000; // 10 seconds - poll for map updates (pins and users)

export function meta({}: Route.MetaArgs) {
  return [
    { title: "LiveMap - Real-time Location Sharing" },
    {
      name: "description",
      content: "View and share real-time locations with other active users on an interactive map",
    },
  ];
}

// Loader to fetch all active locations and police pins
export async function loader() {
  const { getAllLocations, getAllPolicePins } = await import("~/services/location-service");
  const locations = getAllLocations();
  const policePins = getAllPolicePins();
  return { locations, policePins };
}

// Action to update or remove location, or add police pin
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const userId = formData.get("userId") as string;
  
  const { updateLocation, removeLocation, addPolicePin } = await import("~/services/location-service");
  
  if (action === "update") {
    const latitude = parseFloat(formData.get("latitude") as string);
    const longitude = parseFloat(formData.get("longitude") as string);
    const name = formData.get("name") as string;
    return updateLocation(userId, latitude, longitude, name);
  } else if (action === "remove") {
    return removeLocation(userId);
  } else if (action === "police") {
    const latitude = parseFloat(formData.get("latitude") as string);
    const longitude = parseFloat(formData.get("longitude") as string);
    const userName = formData.get("userName") as string;
    return addPolicePin(userId, userName, latitude, longitude);
  }
  
  return { success: false };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userId] = useState(() => generateUserId());
  const [userName, setUserName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  
  // Load user name from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("livemap-user-name");
      if (stored) setUserName(stored);
    }
  }, []);
  
  // Save user name to localStorage
  const saveUserName = (name: string) => {
    setUserName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("livemap-user-name", name);
    }
    setIsEditingName(false);
  };
  const [lastAction, setLastAction] = useState<string | null>(null);
  const fetcher = useFetcher();
  const pollFetcher = useFetcher<typeof loader>();
  
  // Get locations and police pins from loader data or poll fetcher
  const locations = (pollFetcher.data?.locations || loaderData.locations) as UserLocation[];
  const policePins = (pollFetcher.data?.policePins || loaderData.policePins) as PolicePin[];
  
  // Filter out current user from the list
  const otherUsers = locations.filter(user => user.id !== userId);

  // Send location to server
  const sendLocationToServer = (latitude: number, longitude: number) => {
    const formData = new FormData();
    formData.append("action", "update");
    formData.append("userId", userId);
    formData.append("latitude", latitude.toString());
    formData.append("longitude", longitude.toString());
    formData.append("name", userName || `User ${userId.slice(0, 4)}`);
    
    fetcher.submit(formData, { method: "post" });
  };
  
  // Send police pin to server
  const sendPolicePin = () => {
    if (!currentUserLocation) {
      toast({
        title: "Location required",
        description: "Please enable location sharing first.",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("action", "police");
    formData.append("userId", userId);
    formData.append("latitude", currentUserLocation.latitude.toString());
    formData.append("longitude", currentUserLocation.longitude.toString());
    formData.append("userName", userName || `User ${userId.slice(0, 4)}`);
    
    setLastAction("police");
    fetcher.submit(formData, { method: "post" });
    
    // Immediately poll to update map with new pin
    pollFetcher.load("/");
  };
  
  // Zoom to nearest police pin
  const zoomToNearestPolice = () => {
    if (!currentUserLocation || policePins.length === 0) {
      toast({
        title: "No police pins",
        description: policePins.length === 0 ? "No active police pins on the map." : "Enable location sharing first.",
        variant: "destructive",
      });
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
      const distance = calculateDistance(
        currentUserLocation.latitude,
        currentUserLocation.longitude,
        policePins[i].latitude,
        policePins[i].longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestPin = policePins[i];
      }
    }
    
    // Dispatch custom event to zoom the map
    window.dispatchEvent(
      new CustomEvent('zoom-to-location', {
        detail: {
          latitude: nearestPin.latitude,
          longitude: nearestPin.longitude,
          zoom: 16
        }
      })
    );
  };
  
  // Zoom to current user location
  const zoomToMyLocation = () => {
    if (!currentUserLocation) {
      toast({
        title: "Location not available",
        description: "Please enable location sharing first.",
        variant: "destructive",
      });
      return;
    }
    
    // Dispatch custom event to zoom the map
    window.dispatchEvent(
      new CustomEvent('zoom-to-location', {
        detail: {
          latitude: currentUserLocation.latitude,
          longitude: currentUserLocation.longitude,
          zoom: 16
        }
      })
    );
  };
  
  // Handle fetcher response for police pin
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle" && lastAction) {
      const data = fetcher.data as { success?: boolean; error?: string };
      if (data.success === false && data.error) {
        toast({
          title: "Cannot place pin",
          description: data.error,
          variant: "destructive",
        });
        setLastAction(null);
      } else if (data.success === true && !data.error && lastAction === "police") {
        toast({
          title: "Police alert placed",
          description: "Your alert has been added to the map.",
        });
        setLastAction(null);
      }
    }
  }, [fetcher.data, fetcher.state, lastAction]);
  
  // Request location permission and get current location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser does not support geolocation.",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentUserLocation({ latitude, longitude });
        setIsSharing(true);
        sendLocationToServer(latitude, longitude);
        toast({
          title: "Location sharing enabled",
          description: "Your location is now visible to other users.",
        });
      },
      (error) => {
        setIsSharing(false);
        let message = "Unable to retrieve your location.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission denied. Please enable location access in your browser settings.";
        }
        toast({
          title: "Location access denied",
          description: message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  // Toggle location sharing
  const handleToggle = () => {
    if (isSharing) {
      setIsSharing(false);
      setCurrentUserLocation(null);
      
      // Remove location from server
      const formData = new FormData();
      formData.append("action", "remove");
      formData.append("userId", userId);
      fetcher.submit(formData, { method: "post" });
      
      toast({
        title: "Location sharing disabled",
        description: "Your location is no longer visible to others.",
      });
    } else {
      requestLocation();
    }
  };

  // Poll for map updates (users and pins) every 10 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      pollFetcher.load("/");
    }, MAP_POLL_INTERVAL);
    
    return () => clearInterval(pollInterval);
  }, []);
  
  // Immediately poll when fetcher completes (for immediate pin updates)
  useEffect(() => {
    if (fetcher.state === 'idle' && lastAction === 'police') {
      // Small delay to ensure server state is updated
      setTimeout(() => pollFetcher.load("/"), 200);
    }
  }, [fetcher.state, lastAction]);
  
  // Update current user location every 10 seconds
  useEffect(() => {
    if (!isSharing) return;
    
    const updateInterval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCurrentUserLocation({ latitude, longitude });
            sendLocationToServer(latitude, longitude);
          },
          (error) => {
            console.error("Error updating location:", error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
        );
      }
    }, POSITION_UPDATE_INTERVAL);

    return () => clearInterval(updateInterval);
  }, [isSharing, userId]);

  const activeUsersCount = locations.length;

  return (
    <div className={styles.container}>
      <div className={styles.mapSection}>
        <LocationMap
          users={otherUsers}
          policePins={policePins}
          currentUserLocation={currentUserLocation}
          currentUserName={userName}
        />
      </div>
      
      <div className={styles.buttonsWrapper}>
        <LocationToggle isSharing={isSharing} onToggle={handleToggle} />
        <button
          onClick={sendPolicePin}
          className={styles.alarmButton}
          aria-label="Place police alert"
        >
          <span className={styles.policeIcon}>👮</span>
        </button>
      </div>

      <div className={styles.topPanel}>
        <div className={styles.topRow}>
          <div className={styles.counters}>
            <button
              onClick={zoomToNearestPolice}
              className={styles.policeCount}
              aria-label="Zoom to nearest police pin"
            >
              <ShieldAlert size={16} />
              <span>{policePins.length}</span>
            </button>
            
            <button
              onClick={zoomToMyLocation}
              className={styles.userCount}
              aria-label="Zoom to my location"
            >
              <Users size={16} />
              <span>{activeUsersCount}</span>
            </button>
          </div>
          
          {isEditingName ? (
            <div className={styles.nameBox}>
              <Input
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && userName.trim()) {
                    saveUserName(userName);
                  } else if (e.key === "Escape") {
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className={styles.nameInputField}
              />
              <Button
                onClick={() => {
                  if (userName.trim()) {
                    saveUserName(userName);
                  } else {
                    toast({
                      title: "Name required",
                      description: "Please enter your name.",
                      variant: "destructive",
                    });
                  }
                }}
                size="sm"
              >
                Save
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className={styles.nameBox}
            >
              {userName || "Set your name"}
            </button>
          )}
        </div>
        
        <NearestPolice 
          currentUserLocation={currentUserLocation}
          policePins={policePins}
        />
      </div>
    </div>
  );
}

// Generate a unique user ID and persist it
function generateUserId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("livemap-user-id");
    if (stored) return stored;
    
    const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("livemap-user-id", newId);
    return newId;
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
