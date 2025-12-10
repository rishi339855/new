import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ALGORITHM = 'aes-256-cbc';
// Get key from env or use a fallback for dev (NOT SAFE FOR PROD)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
    ? crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY)).digest('base64').substr(0, 32)
    : crypto.createHash('sha256').update('fallback_secret_key_dev').digest('base64').substr(0, 32);

export const encrypt = (text: string): { content: string; iv: string } => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

export const decrypt = (hash: { content: string; iv: string }): string => {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), Buffer.from(hash.iv, 'hex'));
    let decrpyted = decipher.update(Buffer.from(hash.content, 'hex'));
    decrpyted = Buffer.concat([decrpyted, decipher.final()]);
    return decrpyted.toString();
};
