# 🛡️ MPC Non-Custodial Secure Wallet

> **"The Bank Vault in Your Browser"**

A state-of-the-art **Multi-Party Computation (MPC)** wallet that splits your private key into three mathematical shards. It offers the security of a "Multisig" without the high gas fees, ensuring that **no single party** (not even you, and definitely not the server) ever holds the full private key.

![Status](https://img.shields.io/badge/Security-Threshold_2--of--3-green) ![Stack](https://img.shields.io/badge/Stack-MERN_%2B_Access_Control-blue) ![Crypto](https://img.shields.io/badge/Cryptography-Elliptic_Curve_secp256k1-orange)

---

## 🌟 Key Features

### 1. True Non-Custodial Security (2-of-3)
We utilize a **(2, 3) Threshold Scheme**. The private key is mathematically split into 3 shares. Reconstructing the key (signing) requires **any 2** shares to combine.
-   **Share A (Client):** Stored on your device (you hold this).
-   **Share B (Server):** Stored in our encrypted database (we hold this).
-   **Share C (Recovery):** A PDF backup file (your "Break Glass in Emergency" key).

**Result:**
-   If we get hacked: Your funds are safe (Hacker only has Share B).
-   If you lose your device: Your funds are safe (You use Share C + Server to recover).

### 2. Joint-Feldman Distributed Key Generation (DKG)
Unlike standard wallets where the key is created on one machine and then split, our wallet uses **True DKG**.
-   The "Master Secret" is born distributed.
-   It is computed as the sum of secrets from the Client, Server, and Recovery nodes.
-   **The full private key never physically exists in memory during creation.**

### 3. Threshold Signature Scheme (TSS)
When you send a transaction, we use **Lagrange Interpolation** to momentarily reconstruct the key in a secure, ephemeral memory space (RAM), sign the transaction, and immediately zero-out the memory.
-   **Trapdoor Security:** The server's share is locked in MongoDB using AES-256 encryption. It is only decrypted for the millisecond required to sign.
-   **EIP-2 Compliance:** We enforce canonical "Low-S" signatures to ensure perfect compatibility with Ethereum networks.

### 4. Zero-Knowledge Architecture
-   The server never sees your Share A.
-   You never see the Server's Share B.
-   The "Meeting Point" is a mathematical function, not a storage location.

---

## 🛠️ Technology Stack

### Frontend
-   **Framework:** React (+ Vite for Blazing Speed)
-   **Language:** TypeScript
-   **Styling:** CSS Modules with Glassmorphism/Modern UI/UX
-   **Cryptography:** `elliptic` (for curve math), `BN.js` (for big numbers)

### Backend
-   **Runtime:** Node.js (Express)
-   **Database:** MongoDB (Mongoose)
-   **Security:** AES-256-CBC Encryption for Database "At Rest" protection.
-   **Communication:** Socket.IO (Real-time DKG Coordination)
-   **Blockchain:** `ethers.js` v6 (Interaction with Sepolia Testnet)

---

## 🚀 Setup Guide

### Prerequisites
-   Node.js (v18+)
-   MongoDB (Running locally or on Atlas)

### 1. Backend Setup
The backend handles the coordination, encrypted storage, and broadcasting.

```bash
cd backend

# Install Dependencies
npm install

# Configure Environment
# Create a .env file with the following:
# PORT=5001
# MONGO_URI=mongodb://127.0.0.1:27017/mpc_wallet
# ENCRYPTION_KEY=your_super_secret_64_char_hex_string
# SEPOLIA_RPC_URL=https://1rpc.io/sepolia
# ETHERSCAN_API_KEY=your_key_optional

# Start the Server
npm run dev
```

### 2. Frontend Setup
The user interface for creating wallets and initiating transactions.

```bash
# In the root folder (or frontend folder)
npm install

# Start the Development Server
npm run dev
```

Open your browser to `http://localhost:5173`.

---

## 📖 How It Works

### Part 1: Creation (The Ceremony)
1.  **User Init:** You click "Create Wallet".
2.  **Commitments:** Client, Server, and Recovery nodes exchange "Commitments" (Hidden values).
3.  **Shares:** They exchange "Shares" over a secure socket.
4.  **Result:**
    -   Address is generated.
    -   You download `shareA.json` (Your Key).
    -   Server saves Encrypted `shareB` to MongoDB.
    -   You download a **Recovery PDF** containing `shareC`.

### Part 2: Sending Money (The Collaboration)
1.  **Initiate:** You enter an amount and receiver address.
2.  **Authenticate:** You **Upload `shareA.json`**.
3.  **The Handshake:**
    -   Frontend sends `Share A` to Backend.
    -   Backend decrypts `Share B` from DB.
4.  **The Signature:**
    -   Backend calculates: `Signature = Sign(Share A + Share B)`.
    -   *Note: Share A and Share B are combined purely in math, never stored.*
5.  **Broadcast:** The signed transaction is pushed to Ethereum.

### Part 3: Recovery (Disaster Mode)
Lost your file? Laptop broken?
1.  Go to "Send Transaction".
2.  Upload `shareC_recovery.json` (from your PDF backup) instead of Share A.
3.  The math works identically: `Share C + Share B` = Valid Signature.
4.  **Access Restored.**

---

## 🔒 Security Deep Dive

| Attack Vector | Result | Why? |
| :--- | :--- | :--- |
| **Server Database Leak** | 🛡️ **SAFE** | Share B is Encrypted. Hacker needs the `.env` key. |
| **Hacker Steals Laptop** | 🛡️ **SAFE** | They have Share A, but need Share B (Server) to sign. |
| **Malicious Server Admin** | 🛡️ **SAFE** | Admin has Share B, but needs Share A (You) to sign. |
| **Rogue Developer** | 🛡️ **SAFE** | Private keys are ephemeral (RAM only) and never logged. |

---

## 📜 License
MIT
