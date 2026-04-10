#!/bin/bash

# Package JobFlow Extension for Release
# Usage: ./scripts/package-release.sh

set -e

echo "🚀 Packaging JobFlow Extension for Release..."

# Get version from package.json
VERSION=$(node -p "require('./extension/dashboard/package.json').version")
echo "📦 Version: $VERSION"

# Create releases directory
mkdir -p releases

# Clean and build dashboard
echo "🔨 Building dashboard..."
cd extension/dashboard
npm run build
cd ../..

# Create Chrome package (uses manifest_chrome.json)
echo "📱 Creating Chrome package..."
cd extension/dist
cp manifest_chrome.json manifest.json
# Remove files we don't want in the package
rm -f manifest_chrome.json
python3 -c "
import zipfile
import os

with zipfile.ZipFile('../../releases/jobflow-chrome-v${VERSION}.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            file_path = os.path.join(root, file)
            if not file.endswith('.DS_Store'):
                zf.write(file_path, file_path.lstrip('./'))
"
cd ../..

# Create Firefox package (uses manifest.json - already MV2)
echo "🦊 Creating Firefox package..."
cd extension/dist
# manifest.json is already MV2 for Firefox, so no changes needed
python3 -c "
import zipfile
import os

with zipfile.ZipFile('../../releases/jobflow-firefox-v${VERSION}.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            file_path = os.path.join(root, file)
            if not file.endswith('.DS_Store'):
                zf.write(file_path, file_path.lstrip('./'))
"
cd ../..

# Create source code archive
echo "📄 Creating source code archive..."
python3 -c "
import zipfile
import os

def should_exclude(path):
    excludes = ['node_modules', 'dist', 'releases', '.git', '.DS_Store', '__pycache__']
    return any(excl in path for excl in excludes)

with zipfile.ZipFile('releases/jobflow-source-v${VERSION}.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        # Remove excluded dirs from dirs list to skip traversing them
        dirs[:] = [d for d in dirs if not any(excl in os.path.join(root, d) for excl in ['node_modules', 'dist', 'releases', '.git', '__pycache__'])]
        
        for file in files:
            file_path = os.path.join(root, file)
            if not should_exclude(file_path) and not file.startswith('.') and not file.endswith('.DS_Store'):
                zf.write(file_path)
"

echo "✅ Packages created:"
ls -la releases/

echo ""
echo "🎉 Release packages ready!"
echo "Next steps:"
echo "1. git tag v${VERSION}"
echo "2. git push --tags"  
echo "3. Create GitHub release and upload the zip files from releases/ folder"