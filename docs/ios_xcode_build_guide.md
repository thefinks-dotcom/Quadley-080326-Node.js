# iOS Xcode Build Guide — Quadley & Grace College

## Prerequisites

Before starting, ensure you have the following on your Mac:

- **macOS** (Ventura 13+ recommended)
- **Xcode 15+** — download from the Mac App Store
- **Node.js 18+** — download from https://nodejs.org
- **Yarn** — run `npm install -g yarn`
- **CocoaPods** — run `sudo gem install cocoapods`
- **Expo CLI** — run `npm install -g expo-cli`
- **The Quadley repo cloned locally** — `git clone https://github.com/thefinks-dotcom/Quadley-080326-Node.js.git`

---

## Part 1: Building the Quadley iOS App

### Step 1 — Install Dependencies

Open Terminal and navigate to the mobile folder:

```bash
cd Quadley-080326-Node.js/mobile
yarn install
```

### Step 2 — Generate Native iOS Project (Prebuild)

```bash
TENANT=quadley npx expo prebuild --platform ios --clean
```

This creates a `mobile/ios/` folder containing the full Xcode project. The `--clean` flag ensures a fresh build.

### Step 3 — Install iOS (CocoaPods) Dependencies

```bash
cd ios
pod install
cd ..
```

### Step 4 — Open in Xcode

```bash
open ios/quadleyapp.xcworkspace
```

> Always open the `.xcworkspace` file, NOT the `.xcodeproj` file.

### Step 5 — Configure Signing in Xcode

1. In Xcode, click on the project name in the left sidebar (`quadleyapp`)
2. Select the **quadleyapp** target
3. Go to the **Signing & Capabilities** tab
4. Tick **Automatically manage signing**
5. Set your **Team** to your Apple Developer account
6. Confirm the Bundle Identifier is `com.quadley.app`

### Step 6 — Build & Archive for App Store

1. In the top menu, go to **Product → Destination → Any iOS Device (arm64)**
2. Go to **Product → Archive**
3. Wait for the archive to complete (5–15 minutes)
4. The **Organizer** window will open automatically
5. Click **Distribute App**
6. Choose **App Store Connect** → **Upload**
7. Follow the prompts to upload to App Store Connect

---

## Part 2: Building the Grace College iOS App

Repeat the same steps but using the `grace_college` tenant. After finishing the Quadley build, run a clean prebuild to overwrite the `ios/` folder.

### Step 1 — Generate Native iOS Project (Prebuild)

From the `mobile/` directory:

```bash
TENANT=grace_college npx expo prebuild --platform ios --clean
```

### Step 2 — Install iOS (CocoaPods) Dependencies

```bash
cd ios
pod install
cd ..
```

### Step 3 — Open in Xcode

```bash
open ios/gracecollege.xcworkspace
```

> The workspace filename is based on the app slug. If it differs, run `ls ios/*.xcworkspace` to find the exact name.

### Step 4 — Configure Signing in Xcode

1. Click on the project name in the left sidebar
2. Select the target
3. Go to **Signing & Capabilities**
4. Tick **Automatically manage signing**
5. Set your **Team** to your Apple Developer account
6. Confirm the Bundle Identifier is `com.gracecollege.app`

### Step 5 — Build & Archive for App Store

Same as Quadley Step 6 above:

1. **Product → Destination → Any iOS Device (arm64)**
2. **Product → Archive**
3. In Organizer → **Distribute App → App Store Connect → Upload**

---

## Part 3: Updating Railway to Use the New GitHub Repository

Railway is a cloud deployment platform. To point it at the new repository:

### Step 1 — Log into Railway

Go to https://railway.app and sign in.

### Step 2 — Open Your Project

Click on your Quadley project from the dashboard.

### Step 3 — Open the Service Settings

Click on the service you want to update (e.g., **Backend API** or **Frontend**).

### Step 4 — Change the GitHub Source

1. Go to the **Settings** tab of the service
2. Scroll to the **Source** section
3. Click **Configure** (or the GitHub repo link shown)
4. Click **Disconnect** to remove the old repository
5. Click **Connect Repo**
6. Search for and select: `thefinks-dotcom/Quadley-080326-Node.js`
7. Set the **Branch** to `main` (or whichever branch Railway should deploy from)
8. Click **Save**

### Step 5 — Trigger a Redeploy

1. Go to the **Deployments** tab
2. Click **Deploy** (or push a commit to the new repo to trigger it automatically)

### Step 6 — Repeat for Each Service

If you have multiple Railway services (e.g., a separate backend and frontend service), repeat Steps 3–5 for each one.

---

## Build Number Reference

| Setting | Value |
|---|---|
| App Version | 2.2.0 |
| iOS Build Number | 27 |
| Android Version Code | 61 |

To increment the build number before archiving (required for each new TestFlight/App Store upload), open `mobile/app.config.js` and increase the `buildNumber` value.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `pod install` fails | Run `sudo gem install cocoapods` then retry |
| Signing error in Xcode | Ensure your Apple Developer account is added in Xcode → Settings → Accounts |
| Wrong bundle ID | Re-run `expo prebuild --clean` with the correct `TENANT=` prefix |
| Archive option greyed out | Make sure destination is set to **Any iOS Device**, not a simulator |
| Workspace file not found | Run `ls ios/*.xcworkspace` to find the exact filename |
