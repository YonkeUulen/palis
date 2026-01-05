export interface UserLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: Date;
}

export const mockUsers: UserLocation[] = [];
