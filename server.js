// Bundle catalog. Edit prices/sizes here.
// price = what we charge the customer in GHS (cedis).
// capacity = string GB sent to Datamart (e.g. "1", "5").
// apiNetwork = the network code Datamart's API expects:
//   MTN -> "YELLO", Telecel -> "TELECEL", AirtelTigo -> "at"

export type Bundle = {
  size: string;
  price: number;
  capacity: string;
  apiNetwork: "YELLO" | "TELECEL" | "at";
};

export const PACKAGES: Record<string, Record<string, Bundle>> = {
  MTN: {
    "1": { size: "1GB", price: 4.8, capacity: "1", apiNetwork: "YELLO" },
    "2": { size: "2GB", price: 9.5, capacity: "2", apiNetwork: "YELLO" },
    "3": { size: "3GB", price: 14.8, capacity: "3", apiNetwork: "YELLO" },
    "4": { size: "4GB", price: 19.8, capacity: "4", apiNetwork: "YELLO" },
    "5": { size: "5GB", price: 24.5, capacity: "5", apiNetwork: "YELLO" },
    "6": { size: "6GB", price: 29.5, capacity: "6", apiNetwork: "YELLO" },
    "7": { size: "8GB", price: 37, capacity: "8", apiNetwork: "YELLO" },
    "8": { size: "10GB", price: 45, capacity: "10", apiNetwork: "YELLO" },
    "9": { size: "15GB", price: 65, capacity: "15", apiNetwork: "YELLO" },
    "10": { size: "20GB", price: 85, capacity: "20", apiNetwork: "YELLO" },
    "11": { size: "25GB", price: 105, capacity: "25", apiNetwork: "YELLO" },
    "12": { size: "30GB", price: 126, capacity: "30", apiNetwork: "YELLO" },
    "13": { size: "40GB", price: 162, capacity: "40", apiNetwork: "YELLO" },
    "14": { size: "50GB", price: 208.9, capacity: "50", apiNetwork: "YELLO" },
  },
  TELECEL: {
    "1": { size: "5GB", price: 25, capacity: "5", apiNetwork: "TELECEL" },
    "2": { size: "10GB", price: 38, capacity: "10", apiNetwork: "TELECEL" },
  },
};

export const NETWORK_MENU = `Welcome to NestyDatagh💙

1 - MTN Data
2 - Telecel Data`;

export const MTN_MENU = `MTN Bundles:

1 - 1GB ₵4.80
2 - 2GB ₵9.50
3 - 3GB ₵14.80
4 - 4GB ₵19.80
5 - 5GB ₵24.50
6 - 6GB ₵29.50
7 - 8GB ₵37.00
8 - 10GB ₵45.00
9 - 15GB ₵65.00
10 - 20GB ₵85.00
11 - 25GB ₵105.00
12 - 30GB ₵126.00
13 - 40GB ₵162.00
14 - 50GB ₵208.90

Reply with the bundle number:`;

export const TELECEL_MENU = `Telecel Bundles:

1 - 5GB ₵25.00
2 - 10GB ₵38.00

Reply with the bundle number:`;
