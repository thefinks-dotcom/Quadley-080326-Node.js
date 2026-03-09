# Quadley Mobile App

A comprehensive React Native (Expo) mobile application for the Quadley Residential College platform.

## Features

### Student Features
- **Home Dashboard** - Quick access to all modules
- **Events** - Browse and RSVP to college events
- **Announcements** - View college announcements with priority levels
- **Messages** - Direct messages and group chats
- **College Jobs** - Browse and apply for campus jobs
- **Dining** - View menus and request late meals
- **Maintenance** - Submit and track service requests
- **Recognition** - Give and receive recognition
- **Wellbeing** - Access wellness resources and support

### Admin Features
- **Admin Dashboard** - Overview of college stats
- **User Management** - View and manage user roles
- **Event Management** - Create and manage events
- **Announcements** - Post announcements with priority
- **Job Management** - Post jobs and review applications
- **Service Requests** - Manage maintenance requests
- **Recognition** - View all recognitions
- **Reports & Insights** - Analytics dashboard
- **Admin Settings** - Module toggles and advanced options

## Tech Stack

- **Expo SDK 51** - React Native development framework
- **React Navigation 6** - Navigation library
- **TanStack Query** - Data fetching and caching
- **Expo SecureStore** - Secure token storage
- **Axios** - HTTP client
- **date-fns** - Date utilities

## Getting Started

### Prerequisites
- Node.js 18+
- Yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your mobile device

### Installation

1. Navigate to the mobile directory:
```bash
cd /app/mobile
```

2. Install dependencies:
```bash
yarn install
```

3. Start the development server:
```bash
yarn start
# or
expo start
```

4. Scan the QR code with:
   - **iOS**: Camera app or Expo Go
   - **Android**: Expo Go app

## Project Structure

```
mobile/
├── App.js                 # App entry point
├── app.json              # Expo configuration
├── package.json          # Dependencies
├── babel.config.js       # Babel configuration
├── tailwind.config.js    # Tailwind configuration
├── assets/               # App icons and splash screen
└── src/
    ├── config/
    │   └── api.js        # API configuration
    ├── contexts/
    │   └── AuthContext.js # Authentication context
    ├── navigation/
    │   ├── RootNavigator.js      # Root navigation
    │   ├── StudentTabNavigator.js # Student tabs
    │   └── AdminTabNavigator.js   # Admin tabs
    ├── screens/
    │   ├── auth/         # Authentication screens
    │   ├── student/      # Student screens
    │   └── admin/        # Admin screens
    └── services/
        ├── api.js        # Axios instance
        └── authService.js # Auth API calls
```

## API Configuration

The app connects to the Quadley backend at:
```
https://mobile-redesign-20.preview.emergentagent.com/api
```

## Test Credentials

- **Admin**: gen@quadley.app / Quadley2025!
- **Student**: alice@example.com / alice123

## Building for Production

### iOS
```bash
expo build:ios
```

### Android
```bash
expo build:android
```

### EAS Build (Recommended)
```bash
eas build --platform all
```

## Contributing

1. Follow the existing code style
2. Test on both iOS and Android
3. Update this README if adding new features

## License

Proprietary - Quadley
