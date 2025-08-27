# iOS Build and Archive Guide for Mireva

## 📱 App Configuration

- **App Name**: Mireva
- **Bundle ID**: `com.sizarta.mireva`
- **Version**: 004
- **Current Build**: 97
- **Team ID**: 5RR7H4TT63
- **Minimum iOS**: 15.1

## 🚀 Quick Archive & Upload

### 1. Clean Build
```bash
cd ios
xcodebuild clean -project Mireva.xcodeproj -scheme Mireva
```
Or in Xcode: **Product → Clean Build Folder** (⇧⌘K)

### 2. Archive
In Xcode:
1. Select **Any iOS Device** as destination (not simulator)
2. **Product → Archive**
3. Wait for build to complete

### 3. Upload to TestFlight
1. In Organizer, select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Select **Upload**
5. Use default options
6. Upload will go to existing app with bundle ID `com.sizarta.mireva`

## 🔧 Build Settings

### Version Management
- **Marketing Version**: Set in `MARKETING_VERSION` (currently 004)
- **Build Number**: Set in `CURRENT_PROJECT_VERSION` (increment for each upload)

### Important Files
```
ios/
├── Mireva.xcodeproj/project.pbxproj  # Main project configuration
├── Mireva/Info.plist                 # App metadata
├── Podfile                           # CocoaPods dependencies
└── Mireva.xcworkspace               # Use this to open in Xcode
```

## 📝 Pre-Upload Checklist

- [ ] Increment build number in `project.pbxproj`
- [ ] Verify bundle ID is `com.sizarta.mireva`
- [ ] Ensure version format is 3 digits (e.g., 004)
- [ ] Clean build folder
- [ ] Select "Any iOS Device" as destination

## 🔄 Updating Build Number

Edit `ios/Mireva.xcodeproj/project.pbxproj`:
```
CURRENT_PROJECT_VERSION = 98;  // Increment this
```

The Info.plist uses `$(CURRENT_PROJECT_VERSION)` variable automatically.

## ⚠️ Troubleshooting

### "App Record Creation Error"
- Ensure bundle ID is exactly `com.sizarta.mireva`
- Verify you're signed into correct Apple ID
- Check Team ID is 5RR7H4TT63

### Archive Not Appearing
- Ensure you selected "Any iOS Device" not a simulator
- Clean build folder and try again
- Check for build errors in Report Navigator

### Upload Fails
- Build number must be higher than last TestFlight build
- Version format must be 3 digits (004 not 0.0.4)
- Use Transporter app as alternative upload method

## 🌐 Backend Configuration

The app connects to `https://mireva.life` for all API calls.
Backend runs on EC2: `18.215.164.114`

## 📱 TestFlight History

- Last successful upload: Version 003 (Build 96)
- Bundle ID: `com.sizarta.mireva`
- Current TestFlight builds: 32-38 (from previous uploads)

## 🛠 Required Tools

- Xcode 15.0+
- CocoaPods (`pod install` if needed)
- Valid Apple Developer account
- Signing certificate for Team 5RR7H4TT63

## 🔍 Quick Commands

```bash
# Check current configuration
grep -E "CURRENT_PROJECT_VERSION|MARKETING_VERSION|PRODUCT_BUNDLE_IDENTIFIER" ios/Mireva.xcodeproj/project.pbxproj

# Clean all build artifacts
rm -rf ~/Library/Developer/Xcode/DerivedData/*
cd ios && xcodebuild clean

# View recent archives
ls -la ~/Library/Developer/Xcode/Archives/
```