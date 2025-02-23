import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    "name": "loco",
    "slug": "loco",
    "version": "0.1.5",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "platforms": ["ios", "android"],
    "userInterfaceStyle": "light",
    "newArchEnabled": false,
    "experiments": {
      "turboModules": false,
      "coreModules": false,
      "unoptimizedReports": false,
      "enableAsyncDefaults": false,
      "concurrentRoot": false,
      "fabric": false
    },
    "plugins": [
      [
        "react-native-radar",
        {
          "iosFraud": false,
          // "iosNSLocationWhenInUseUsageDescription": "We use your location to help share your position in real-time.",
          // "iosNSLocationAlwaysAndWhenInUseUsageDescription": "Background location is used so your friends can see your location even if the app is closed.",
          "iosBackgroundMode": true,
          "androidFraud": false,
          "androidBackgroundPermission": true,
          "androidFineLocationPermission": true,
          "addRadarSDKMotion": false
        }
      ],
      [
        "@rnmapbox/maps",
        {
          "RNMapboxMapsDownloadToken": process.env.MAPBOX_DOWNLOADS_TOKEN,
          "RNMapboxMapsVersion": "11.8.0"
        }
      ],
      [
        "expo-location",
        {
          // "locationWhenInUsePermission": "Show current location on map.",
          // "locationAlwaysPermission": "Background location usage...",
          // "locationAlwaysAndWhenInUsePermission": "Allow Loco to use your location.",
          "isIosBackgroundLocationEnabled": true,
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      ["expo-image-picker"],
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#19456B",
          "image": "./assets/splash.png",
          "imageWidth": 200
        }
      ]
    ],
    "ios": {
      "buildNumber": "0.1.5",
      "supportsTablet": true,
      "bundleIdentifier": "com.antoninbeliard.loco",
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "fetch"
        ],
        "NSLocationWhenInUseUsageDescription": "We need your location to show your position on the map and share it with friends.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "We need background location access to share your live location with friends, even when the app is in the background or closed.",
        "NSLocationAlwaysUsageDescription": "We need background location access to share your live location with friends, even when the app is in the background or closed." // Include this for older iOS versions, even though it's deprecated.
      }
    },
    "android": {
      "package": "com.antoninbeliard.loco",
      "icon": "./assets/icon.png",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE"
      ]
    },
    "permissions": [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "WAKE_LOCK"
    ],
    "extra": {
      "eas": {
        "projectId": "eacea42d-f4e8-4a94-b43a-f19dc934865e"
      }
    }
  };
};