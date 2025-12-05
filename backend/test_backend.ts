import { sendTransaction } from './src/controllers/walletController';
import { Request, Response } from 'express';

const mockReq = {
    body: {
        shares: [],
        sender: '0x123',
        to: '0x456',
        value: '0.1'
    }
} as unknown as Request;

const mockRes = {
    status: (code: number) => {
        console.log('Status:', code);
        return mockRes;
    },
    json: (data: any) => {
        console.log('JSON:', data);
        return mockRes;
    }
} as unknown as Response;

console.log('Running sendTransaction test...');
sendTransaction(mockReq, mockRes)
    .then(() => console.log('Done'))
    .catch(err => console.error('Crash:', err));
