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
          "iosNSLocationWhenInUseUsageDescription": "We use your location to help share your position in real-time.",
          "iosNSLocationAlwaysUsageDescription": "Background location is used so your friends can see your location even if the app is closed.",
          "iosNSLocationAlwaysAndWhenInUseUsageDescription": "Background location is used so your friends can see your location even if the app is closed.",
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
          "RNMapboxMapsVersion": "11.0.0"
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Show current location on map.",
          "locationAlwaysPermission": "Background location usage...",
          "locationAlwaysAndWhenInUsePermission": "Allow Loco to use your location."
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
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "fetch"
        ],
        "NSLocationWhenInUseUsageDescription": "Show current location on map",
        "NSLocationAlwaysUsageDescription": "Background location usage...",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Background location usage..."
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
    "extra": {
      "eas": {
        "projectId": "eacea42d-f4e8-4a94-b43a-f19dc934865e"
      }
    }
  };
};