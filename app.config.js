import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    "name": "loco",
    "slug": "loco",
    "version": "0.1.4",
    "orientation": "portrait",
    "icon": "./assets/icon.jpg",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#212832"
    },
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
          "iosNSLocationAlwaysAndWhenInUseUsageDescription": "Background location is used so your friends can see your location even if the app is closed.",
          "iosBackgroundMode": true,
          "androidFraud": true,
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
          "locationWhenInUsePermission": "Show current location on map."
        }
      ],
      ["expo-image-picker"]
    ],
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "fetch"
        ],
        "NSLocationWhenInUseUsageDescription": "Show current location on map",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Background location usage..."
      },
      "config": {
        "googleMapsApiKey": "AIzaSyCCkJk7m5UqYt9_dHHxjA0zzvWKadSn41U"
      },
    },
    "android": {
      "package": "com.antoninbeliard.loco",
      "icon": "./assets/icon.png",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#212832"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE"
      ],
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSyAgtPIWpSfr1a2dxUdBxXVw7Xah1yqL9YQ"
        }
      }
    },
    "extra": {
      "eas": {
        "projectId": "eacea42d-f4e8-4a94-b43a-f19dc934865e"
      }
    }
  };
};