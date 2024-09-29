#!/bin/bash

curl -s https://raw.githubusercontent.com/zunxbt/logo/main/logo.sh | bash
sleep 3

# Function to display messages
show() {
    echo -e "\e[32m$1\e[0m"  # Green colored message
}

mkdir -p Eclipse && cd Eclipse
# Function to install Node.js, npm, Rust, and Solana
install_all() {
    show "Installing Node.js and npm..."
    source <(wget -O - https://raw.githubusercontent.com/zunxbt/installation/main/node.sh)
    show "Node.js and npm installation completed."

    show "Installing Rust..."
    source <(wget -O - https://raw.githubusercontent.com/zunxbt/installation/main/rust.sh)
    show "Rust installation completed."

    if ! command -v solana &> /dev/null; then
        show "Solana not found. Installing Solana..."
        # Install Solana using the official installer
        sh -c "$(curl -sSfL https://release.solana.com/v1.18.18/install)"
    else
        show "Solana is already installed."
    fi

    # Add Solana to PATH if not already added
    if ! grep -q "$HOME/.local/share/solana/install/active_release/bin" ~/.bashrc; then
        echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
        show "Added Solana to PATH in .bashrc."
    fi

    if [ -n "$ZSH_VERSION" ]; then
        if ! grep -q "$HOME/.local/share/solana/install/active_release/bin" ~/.zshrc; then
            echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.zshrc
            show "Added Solana to PATH in .zshrc."
        fi
    fi

    # Source the appropriate config file
    if [ -n "$BASH_VERSION" ]; then
        source ~/.bashrc
    elif [ -n "$ZSH_VERSION" ]; then
        source ~/.zshrc
    fi

    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    
    if command -v solana &> /dev/null; then
        show "Solana is available in the current session."
    else
        show "Failed to add Solana to the PATH. Exiting."
        exit 1
    fi
}

# Function to set up wallet
setup_wallet() {
    KEYPAIR_DIR="$HOME/solana_keypairs"
    mkdir -p "$KEYPAIR_DIR"

    show "Do you want to use an existing wallet or create a new one?"
    PS3="Please enter your choice (1 or 2): "
    options=("Use existing wallet" "Create new wallet")
    select opt in "${options[@]}"; do
        case $opt in
            "Use existing wallet")
                show "Recovering from existing wallet..."
                KEYPAIR_PATH="$KEYPAIR_DIR/eclipse-wallet.json"
                solana-keygen recover -o "$KEYPAIR_PATH" --force
                if [[ $? -ne 0 ]]; then
                    show "Failed to recover the existing wallet. Exiting."
                    exit 1
                fi
                break
                ;;
            "Create new wallet")
                show "Creating a new wallet..."
                KEYPAIR_PATH="$KEYPAIR_DIR/eclipse-wallet.json"
                solana-keygen new -o "$KEYPAIR_PATH" --force
                if [[ $? -ne 0 ]]; then
                    show "Failed to create a new wallet. Exiting."
                    exit 1
                fi
                break
                ;;
            *) show "Invalid option. Please try again." ;;
        esac
    done

    solana config set --keypair "$KEYPAIR_PATH"
    show "Wallet setup completed!"

    cp "$KEYPAIR_PATH" "$PWD"
}


create_and_install_dependencies() {
    # Remove existing package.json if available
    rm -f package.json

    # Create package.json file
    cat <<EOF > package.json
{
  "name": "eclipse-nft",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "@metaplex-foundation/umi": "^0.9.2",
    "@metaplex-foundation/umi-bundle-defaults": "^0.9.2",
    "@nifty-oss/asset": "^0.6.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "typescript": "^5.6.2"
  }
}
EOF

    show "package.json file created."

    show "Installing npm dependencies..."
    npm install --only=development
    show "Npm dependencies installation completed."
}

ts_file_Setup() {
    # Check if index.ts exists and remove it
    if [ -f index.ts ]; then
        rm index.ts
    else
        echo "index.ts does not exist. Skipping removal."
    fi
    
    # Download the new index.ts file
    wget -O index.ts https://raw.githubusercontent.com/zunxbt/Eclipse-NFT/main/index.ts

# Ask the user for the required information
read -p "Enter NFT Name: " nft_name
read -p "Enter NFT Symbol: " nft_symbol
read -p "Enter NFT Description (INFO): " nft_info
read -p "Enter Pinata API Key: " pinata_api_key
read -p "Enter Pinata Secret Key: " pinata_secret_key

# Ask user for the network type
echo "Select the network to create the NFT:"
echo "1) Mainnet"
echo "2) Testnet"
read -p "Enter your choice (1 for Mainnet, 2 for Testnet): " network_choice

# Set the network based on user choice
if [ "$network_choice" == "1" ]; then
    network="mainnet"
elif [ "$network_choice" == "2" ]; then
    network="testnet"
else
    echo "Invalid choice. Exiting."
    exit 1
fi

# Define the file to modify (replace this with the actual file path)
file_path="./index.ts"

# Use sed to replace the placeholders with user input
sed -i "s/NAME/$nft_name/" "$file_path"
sed -i "s/SYMBOL/$nft_symbol/" "$file_path"
sed -i "s/INFO/$nft_info/" "$file_path"
sed -i "s/ZUNXBT1/$pinata_api_key/" "$file_path"
sed -i "s/ZUNXBT2/$pinata_secret_key/" "$file_path"
sed -i "s/ZUNXBT3/$network/" "$file_path"

echo "NFT details and network have been updated in $file_path"
   

if [ -f upload.ts ]; then
        rm upload.ts
    else
        echo "upload.ts does not exist. Skipping removal."
    fi
    
    # Download the new index.ts file
    wget -O upload.ts https://raw.githubusercontent.com/zunxbt/Eclipse-NFT/main/upload.ts
    rm -f tsconfig.json
    npx tsc --init
}

mint() {
    show "Minting..."
    wget https://picsum.photos/200 -O image.jpg
    npx ts-node index.ts
}

# Function to display the menu
show_menu() {
    echo -e "\n\e[34m===== Eclipse NFT Setup Menu =====\e[0m"
    echo "1) Install Node.js, Rust, and Solana"
    echo "2) Set up Wallet"
    echo "3) Install npm dependencies"
    echo "4) Setup Mint File"
    echo "5) Start Minting"
    echo "6) Exit"
    echo -e "===================================\n"
}

# Main loop
while true; do
    show_menu
    read -p "Choose an option [1-6]: " choice
    case $choice in
        1) install_all ;;
        2) setup_wallet ;;
        3) create_and_install_dependencies ;;
        4) ts_file_Setup ;;
        5) mint ;;
        6) show "Exiting the script."; exit 0 ;;
        *) show "Invalid option. Please try again." ;;
    esac
done
