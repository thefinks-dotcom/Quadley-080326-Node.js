# iOS Build Guide — Quadley & Grace College
### Terminal + Xcode, step by step

---

## Prerequisites

Run all of the following in Terminal on your Mac before starting.

### 1. Install Xcode
Download from the Mac App Store. Once installed, accept the license:
```bash
sudo xcodebuild -license accept
```
Install the Xcode command line tools:
```bash
xcode-select --install
```

### 2. Install Node.js (if not already installed)
```bash
# Check if you have it
node --version

# If not, install via Homebrew
brew install node
```
If you don't have Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

### 3. Install Yarn
```bash
npm install -g yarn
```

### 4. Install CocoaPods
```bash
sudo gem install cocoapods
```
Verify:
```bash
pod --version
```

### 5. Install Expo CLI
```bash
npm install -g expo-cli
```

### 6. Clone the Repository
```bash
git clone https://github.com/thefinks-dotcom/Quadley-080326-Node.js.git
cd Quadley-080326-Node.js
```

---

## Build 1: Quadley iOS App

Work from the `mobile/` folder for all terminal steps.

### Step 1 — Install JavaScript dependencies
```bash
cd mobile
yarn install
```
Wait for this to finish (may take 2–5 minutes on first run).

### Step 2 — Generate the native iOS project
```bash
TENANT=quadley npx expo prebuild --platform ios --clean
```
This creates the `mobile/ios/` folder with the full Xcode project. You will see:
```
📱 Building app for tenant: quadley (Quadley)
✔ Created native iOS project
```

### Step 3 — Install iOS native dependencies (CocoaPods)
```bash
cd ios
pod install
cd ..
```
This links all native iOS libraries. Expect 2–5 minutes.

### Step 4 — Confirm the workspace file exists
```bash
ls ios/*.xcworkspace
```
You should see: `ios/Quadley.xcworkspace`

### Step 5 — Open in Xcode
```bash
open ios/Quadley.xcworkspace
```
> Always open the `.xcworkspace` file — never the `.xcodeproj` file directly.

### Step 6 — Configure signing in Xcode
1. In the left sidebar, click the project root **Quadley** (blue icon at the top)
2. Under **Targets**, select **Quadley**
3. Click the **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Under **Team**, select your Apple Developer account from the dropdown
6. Verify the **Bundle Identifier** shows `com.quadley.app`
7. Resolve any signing warnings shown (usually just selecting your team is enough)

### Step 7 — Set the destination
In the Xcode toolbar at the top, click the device selector (next to the play button) and choose:
```
Any iOS Device (arm64)
```
Do not select a simulator — App Store builds require a real device target.

### Step 8 — Archive
In the top menu bar:
```
Product → Archive
```
The archive process takes 5–15 minutes. Xcode will show a progress bar at the top.

### Step 9 — Upload to App Store Connect
When archiving finishes, the **Organizer** window opens automatically:
1. Select the archive you just created (it will be at the top of the list)
2. Click **Distribute App**
3. Select **App Store Connect** → click **Next**
4. Select **Upload** → click **Next**
5. Leave all options as default → click **Next**
6. Click **Upload**

The build will appear in App Store Connect under your app within 5–10 minutes.

---

## Build 2: Grace College iOS App

After completing the Quadley build, run a fresh prebuild for Grace College. This overwrites the `ios/` folder with Grace College's configuration.

### Step 1 — Go back to the mobile directory (if you left it)
```bash
cd /path/to/Quadley-080326-Node.js/mobile
```

### Step 2 — Generate the native iOS project for Grace College
```bash
TENANT=grace_college npx expo prebuild --platform ios --clean
```
You will see:
```
📱 Building app for tenant: grace_college (Grace College)
✔ Created native iOS project
```

### Step 3 — Install iOS native dependencies
```bash
cd ios
pod install
cd ..
```

### Step 4 — Confirm the workspace file
```bash
ls ios/*.xcworkspace
```
You should see: `ios/GraceCollege.xcworkspace`

### Step 5 — Open in Xcode
```bash
open ios/GraceCollege.xcworkspace
```

### Step 6 — Configure signing in Xcode
1. Click the project root **GraceCollege** in the left sidebar
2. Under **Targets**, select **GraceCollege**
3. Click **Signing & Capabilities**
4. Check **Automatically manage signing**
5. Set your **Team** to your Apple Developer account
6. Verify the **Bundle Identifier** shows `com.gracecollege.app`

### Step 7 — Set destination and Archive
Same as Quadley:
1. Set destination to **Any iOS Device (arm64)**
2. **Product → Archive**
3. Wait for completion (5–15 minutes)

### Step 8 — Upload to App Store Connect
In Organizer:
1. Select the Grace College archive
2. **Distribute App → App Store Connect → Upload**
3. Leave defaults → **Upload**

---

## App Store Connect IDs

| App | Bundle ID | App Store Connect ID |
|---|---|---|
| Quadley | `com.quadley.app` | `6746585498` |
| Grace College | `com.gracecollege.app` | `6759232709` |

---

## Build Number Reference

| Setting | Value | File to edit |
|---|---|---|
| App Version | `2.2.0` | `mobile/app.config.js` → `version` |
| iOS Build Number | `27` | `mobile/app.config.js` → `buildNumber` |

Each new upload to TestFlight or App Store requires a higher build number than the previous upload. Before archiving a new version, open `mobile/app.config.js` and increment `buildNumber`:
```js
buildNumber: "28",  // was 27, increment by 1 each time
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `pod install` fails with Ruby errors | Run `sudo gem install cocoapods` then retry |
| `pod install` fails with `M1/M2 Mac` architecture error | Run `arch -x86_64 pod install` |
| Signing error: "No profiles for bundle ID" | Ensure your Apple Developer account is added in Xcode → Settings → Accounts |
| Archive greyed out in Product menu | Confirm destination is **Any iOS Device (arm64)**, not a simulator |
| Workspace not found after prebuild | Run `ls ios/*.xcworkspace` to find the exact filename |
| Wrong app name or icon after prebuild | Confirm you used the correct `TENANT=` value and re-ran `--clean` |
| `expo: command not found` | Run `npm install -g expo-cli` then retry |
| Upload fails with "Missing compliance" | Already handled — `ITSAppUsesNonExemptEncryption: false` is set in `app.config.js` |
| `yarn install` hangs | Try `npm install` instead |
