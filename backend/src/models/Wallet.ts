import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
    address: string;
    publicKey: string;
    encryptedShare: string; // The Server Share B (Encrypted)
    iv: string; // Initialization Vector for Encryption
    createdAt: Date;
}

const WalletSchema: Schema = new Schema({
    address: { type: String, required: true, unique: true, index: true },
    publicKey: { type: String, required: true },
    encryptedShare: { type: String, required: true },
    iv: { type: String, required: true }, // Store IV to decrypt
}, { timestamps: true });

export default mongoose.model<IWallet>('Wallet', WalletSchema, 'server');
