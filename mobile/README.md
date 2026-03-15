# Mobile setup

## Requirements

- Node.js 20+ and npm
- Expo CLI (runs via `npx`)

## Install dependencies

From `mobile/`:

1. `npm install`
2. `npx expo install expo-camera react-native-screens react-native-safe-area-context expo-font`
3. `npm install @react-navigation/native @react-navigation/bottom-tabs @expo-google-fonts/space-grotesk`

## Configure API base URL

Set an Expo public env var before running:

`EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:8000`

## Run

`npx expo start`
