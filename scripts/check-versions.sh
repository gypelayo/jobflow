#!/bin/bash
# Version check script - verifies all version numbers are in sync
# Usage: ./scripts/check-versions.sh

echo "Checking version consistency..."
echo ""

ERRORS=0

# Get version from package.json
PACKAGE_VERSION=$(node -p "require('./extension/dashboard/package.json').version")
echo "package.json:        $PACKAGE_VERSION"

# Check manifest.json
MANIFEST_VERSION=$(grep -o '"version": "[^"]*"' extension/manifest.json | head -1 | sed 's/"version": "//;s/"//')
echo "manifest.json:       $MANIFEST_VERSION"

# Check manifest_chrome.json
MANIFEST_CHROME_VERSION=$(grep -o '"version": "[^"]*"' extension/manifest_chrome.json | head -1 | sed 's/"version": "//;s/"//')
echo "manifest_chrome.json: $MANIFEST_CHROME_VERSION"

# Check options.html
OPTIONS_VERSION=$(grep -oP 'JobFlow Extension v\K[0-9]+\.[0-9]+\.[0-9]+' extension/options.html)
echo "options.html:        $OPTIONS_VERSION"

# Check test setup
SETUP_VERSION=$(grep -oP "version: '\K[^']+" extension/dashboard/src/test/setup.ts | head -1)
echo "setup.ts:           $SETUP_VERSION"

# Check privacy policy
PRIVACY_VERSION=$(grep -oP 'JobFlow Extension v\K[0-9]+\.[0-9]+\.[0-9]+' docs/privacy-policy.html)
echo "privacy-policy.html: $PRIVACY_VERSION"

echo ""

# Compare all versions
if [ "$PACKAGE_VERSION" != "$MANIFEST_VERSION" ]; then
    echo "ERROR: package.json and manifest.json versions don't match!"
    ERRORS=$((ERRORS + 1))
fi

if [ "$PACKAGE_VERSION" != "$MANIFEST_CHROME_VERSION" ]; then
    echo "ERROR: package.json and manifest_chrome.json versions don't match!"
    ERRORS=$((ERRORS + 1))
fi

if [ "$PACKAGE_VERSION" != "$OPTIONS_VERSION" ]; then
    echo "ERROR: package.json and options.html versions don't match!"
    ERRORS=$((ERRORS + 1))
fi

if [ "$PACKAGE_VERSION" != "$SETUP_VERSION" ]; then
    echo "ERROR: package.json and setup.ts versions don't match!"
    ERRORS=$((ERRORS + 1))
fi

if [ "$PACKAGE_VERSION" != "$PRIVACY_VERSION" ]; then
    echo "ERROR: package.json and privacy-policy.html versions don't match!"
    ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✓ All versions are consistent: $PACKAGE_VERSION"
    exit 0
else
    echo "✗ Found $ERRORS version mismatch(es)"
    exit 1
fi
