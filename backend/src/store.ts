import { encrypt, decrypt } from './utils/encryption';
import Wallet from './models/Wallet';

export const ShareStore = {
    getShare: async (address: string): Promise<string | undefined> => {
        try {
            const wallet = await Wallet.findOne({ address: address.toLowerCase() });
            if (!wallet) return undefined;

            return decrypt({ content: wallet.encryptedShare, iv: wallet.iv });
        } catch (e) {
            console.error('[STORE] DB Get Error:', e);
            return undefined;
        }
    },

    saveShare: async (address: string, share: string, publicKey: string = '') => {
        try {
            const normalizedAddr = address.toLowerCase();
            const { content, iv } = encrypt(share);

            await Wallet.findOneAndUpdate(
                { address: normalizedAddr },
                {
                    address: normalizedAddr,
                    encryptedShare: content,
                    iv: iv,
                    publicKey: publicKey
                },
                { upsert: true, new: true }
            );

            console.log(`[STORE] Secured share for ${normalizedAddr} in DB`);
        } catch (e) {
            console.error('[STORE] DB Save Error:', e);
        }
    }
};
