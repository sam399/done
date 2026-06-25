# BouncyHabits ⏳🎉

A premium, interactive React Native & Expo habit tracker and countdown timer app designed for Android. It features a central spring-bouncy countdown timer, custom alarms, daily habit management, and robust compatibility safeguards for running in modern Expo Go environments.

![App Screenshot Placeholder](https://raw.githubusercontent.com/username/bouncy-habits/main/assets/screenshot-placeholder.png) <!-- Replace with your own screenshot after pushing -->

---

## ✨ Features

- **⚡ Snappy Bouncy Timer**: An interactive central countdown timer button. Tapping it instantly triggers a tactile scale-down and spring-back animation with zero input delay, starting/pausing your habit session. Long press to reset.
- **📅 Habits & Daily Reminders Manager**: Create custom habits, set their durations (in minutes), and schedule daily alarms (e.g. `09:30`).
- **🛡️ Expo Go Native Compatibility (SDK 53-56+)**: 
  - Standard Expo Go clients strip certain native libraries like `expo-av` (audio playback) and push notifications. 
  - The app runs a custom dynamic checking mechanism at startup (`hasNativeModule`) that detects which native modules are present. 
  - It safely bypasses missing modules to prevent Metro runtime crashes, falling back to **native phone vibrations** (`Vibration.vibrate`) and clear alerts if native audio/notifications are unavailable.
- **💾 Local Storage Persistence**: All habits and timer states are automatically saved and reloaded using `@react-native-async-storage/async-storage`.
- **🌙 Premium Dark Theme**: Sleek, modern dark-mode aesthetic with custom purples and indigos, HSL-tailored borders, and card-based responsive grids.

---

## 🚀 How to Run the App Locally

Anyone can download and run this app on their local machine and preview it on their physical phone using **Expo Go**.

### Prerequisites
- **Node.js** (v18 or higher recommended)
- A physical Android (or iOS) device with the **Expo Go** app installed (downloadable for free from the Google Play Store / Apple App Store).

### Step-by-Step Guide

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/bouncy-habits.git
   cd bouncy-habits
   ```

2. **Install Dependencies**:
   Install all node packages using the legacy peer-dependency flag (recommended for flat-hoisting and clean dependency matching in Expo):
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start the Expo Packager**:
   Launch the development server:
   ```bash
   npm run start
   ```
   *To run in tunnel mode (allows loading the bundle over the internet/cellular data without being on the same Wi-Fi network):*
   ```bash
   npx expo start --tunnel
   ```

4. **Scan and Load**:
   - Open the **Expo Go** app on your phone.
   - Tap **Scan QR Code** and scan the QR code displayed in your terminal.
   - The app will build the JS bundle and load the habit tracker instantly!

---

## 📦 Building a Standalone Production App (.APK)

To package this app into a standalone `.apk` file that has **full access** to native audio alarms and notification scheduling (bypassing the limitations of Expo Go):

1. Install the EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log into your Expo account:
   ```bash
   eas login
   ```
3. Initialize the build configuration:
   ```bash
   eas build:configure
   ```
4. Build the Android package (EAS will compile it securely in the cloud):
   ```bash
   eas build --platform android --profile preview
   ```
5. Once completed, EAS will provide a direct link to download the `.apk` file, which you can install on any Android phone!

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [Expo SDK 56](https://expo.dev) + [React Native](https://reactnative.dev)
- **Icons**: [Lucide React Native](https://lucide.dev/guide/packages/lucide-react-native)
- **State & Storage**: AsyncStorage (Local caching)
- **Animations**: React Native `Animated` API with Spring curves
- **Audio & Notifications**: Conditional `expo-av` and `expo-notifications` loading with native vibration fallbacks.
