#!/bin/bash
# Version bump script - updates version across all project files
# Usage: ./scripts/bump-version.sh [major|minor|patch|<version>]

set -e

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./extension/dashboard/package.json').version")

# Determine new version
if [ -z "$1" ]; then
    echo "Usage: ./scripts/bump-version.sh [major|minor|patch|<version>]"
    echo "Current version: $CURRENT_VERSION"
    exit 1
fi

if [[ "$1" == "major" || "$1" == "minor" || "$1" == "patch" ]]; then
    # Calculate new version
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR="${VERSION_PARTS[0]}"
    MINOR="${VERSION_PARTS[1]}"
    PATCH="${VERSION_PARTS[2]}"
    
    case "$1" in
        major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
        minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
        patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    esac
else
    NEW_VERSION="$1"
fi

echo "Bumping version: $CURRENT_VERSION -> $NEW_VERSION"

# Update package.json
node -p "const pkg = require('./extension/dashboard/package.json'); pkg.version = '$NEW_VERSION'; JSON.stringify(pkg, null, 2)" > extension/dashboard/package.json.tmp
mv extension/dashboard/package.json.tmp extension/dashboard/package.json

# Update manifest files
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" extension/manifest.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" extension/manifest_chrome.json

# Update options.html
sed -i "s/JobFlow Extension v[0-9]*\.[0-9]*\.[0-9]*/JobFlow Extension v$NEW_VERSION/" extension/options.html

# Update test setup
sed -i "s/version: '[0-9]*\.[0-9]*\.[0-9]*'/version: '$NEW_VERSION'/g" extension/dashboard/src/test/setup.ts
sed -i "s/getManifest: () => ({ version: '[0-9]*\.[0-9]*\.[0-9]*' })/getManifest: () => ({ version: '$NEW_VERSION' })/g" extension/dashboard/src/test/setup.ts

# Update SettingsTab test
sed -i "s/getByText('\([^']*\)0\.[0-9]*\.[0-9]*\([^']*\)')/getByText('\1$NEW_VERSION\2')/g" extension/dashboard/src/components/SettingsTab.test.tsx

# Update privacy policy
sed -i "s/JobFlow Extension v[0-9]*\.[0-9]*\.[0-9]*/JobFlow Extension v$NEW_VERSION/" docs/privacy-policy.html

# Update README checklist if it references versions
sed -i "s/v0\.[0-9]*\.[0-9]*/v$NEW_VERSION/g" README.md

echo "Done! Version updated to $NEW_VERSION"
echo ""
echo "Files updated:"
echo "  - extension/dashboard/package.json"
echo "  - extension/manifest.json"
echo "  - extension/manifest_chrome.json"
echo "  - extension/options.html"
echo "  - extension/dashboard/src/test/setup.ts"
echo "  - extension/dashboard/src/components/SettingsTab.test.tsx"
echo "  - docs/privacy-policy.html"
echo "  - README.md"
