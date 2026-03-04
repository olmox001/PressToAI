#!/bin/bash

# Ensure script stops on errors
set -e

echo "============================================="
echo "        PressToAi - Smart Installer         "
echo "============================================="

# 1. Detect OS
OS="$(uname -s)"
echo "[*] Detecting Operating System: $OS"

# 2. Check if Node.js & npm are installed
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "[!] Node.js or npm is NOT installed. Attempting automatic installation..."
    
    if [ "$OS" = "Darwin" ]; then
        # macOS Installation
        if ! command -v brew &> /dev/null; then
            echo "[!] Homebrew not found. Installing Homebrew first..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            # Add brew to path for the rest of the script (common locations)
            eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null)"
        fi
        echo "[*] Installing Node.js via Homebrew..."
        brew install node
        
    elif [ "$OS" = "Linux" ]; then
        # Linux Installation (Apt for Debian/Ubuntu)
        if command -v apt-get &> /dev/null; then
            echo "[*] Installing Node.js via APT (Debian/Ubuntu)..."
            # Using NodeSource for a recent version
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        # Pacman for Arch
        elif command -v pacman &> /dev/null; then
            echo "[*] Installing Node.js via Pacman (Arch Linux)..."
            sudo pacman -Sy --noconfirm nodejs npm
        # Dnf for Fedora
        elif command -v dnf &> /dev/null; then
            echo "[*] Installing Node.js via DNF (Fedora)..."
            sudo dnf install -y nodejs
        # Yum for CentOS/RHEL
        elif command -v yum &> /dev/null; then
            echo "[*] Installing Node.js via YUM..."
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
        else
            echo "[X] Package manager not recognized. Please install Node.js manually: https://nodejs.org/"
            exit 1
        fi
    else
        echo "[X] Unsupported OS: $OS. Please install Node.js manually: https://nodejs.org/"
        exit 1
    fi
    
    echo "[*] Node.js installation complete!"
else
    echo "[*] Node.js is already installed ($(node -v))."
fi

# 3. Install PressToAi globally
echo "[*] Building and installing PressToAi globally..."
# Change to the directory of the script
cd "$(dirname "$0")"

# Execute npm install globally in the current folder. 
# We first run npm install locally to ensure the global symlink works, since we don't upload node_modules to GitHub.
echo "[*] Installing local dependencies..."
npm install

if [ "$OS" = "Linux" ] && [ "$EUID" -ne 0 ]; then
    # Usually global npm installs on Linux default config require sudo
    sudo npm install -g . || npm install -g .
else
    npm install -g .
fi

echo "============================================="
echo "✅ PressToAi successfully installed!"
echo "You can now use the 'PressToAi' command anywhere."
echo "============================================="
