import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { generatePrivateKey, deriveKeys, splitKey, reconstructKey } from '../utils/cryptoUtils';
import { generateWalletPDF } from '../utils/pdfGenerator';

export const createWallet = async (req: Request, res: Response) => {
    try {
        // 1. Generate Keys
        const privateKey = generatePrivateKey();
        const { publicKey, address } = deriveKeys(privateKey);

        // 2. Split Key (2-of-3)
        const shares = splitKey(privateKey);

        // 3. Generate PDF
        const pdfBuffer = await generateWalletPDF({
            address,
            publicKey,
            privateKey,
            shares
        });

        // 4. Convert PDF to Base64 for frontend download
        const pdfBase64 = pdfBuffer.toString('base64');

        // 5. Respond
        res.json({
            success: true,
            data: {
                address,
                publicKey,
                shares: shares.map((share, index) => ({
                    id: String.fromCharCode(65 + index), // A, B, C
                    label: `Share ${String.fromCharCode(65 + index)}`,
                    value: share
                })),
                pdfBackup: pdfBase64
            }
        });

    } catch (error) {
        console.error('Wallet creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create wallet'
        });
    }
};

export const checkBalance = async (req: Request, res: Response) => {
    try {
        const { address } = req.query;

        if (!address || typeof address !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid Ethereum address is required'
            });
        }

        // Connect to provider
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

        // Get balance
        const balanceWei = await provider.getBalance(address);
        const balanceEth = ethers.formatEther(balanceWei);

        res.json({
            success: true,
            address,
            balanceEth,
            network: 'Ethereum Sepolia Testnet'
        });

    } catch (error) {
        console.error('Check balance error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch balance'
        });
    }
};

import { TSSSession } from '../utils/mpc/tssSession';
import { ShareStore } from '../store';
import { computeAddress, keccak256, Transaction as EthTransaction } from 'ethers';

export const sendTransaction = async (req: Request, res: Response) => {
    try {
        const { shares, sender, to, value } = req.body;

        if (!shares || !Array.isArray(shares) || shares.length < 1) {
            return res.status(400).json({ success: false, error: 'User share (A or C) is required' });
        }

        // 1. Get Client Share
        let clientShareData;
        try {
            const shareRaw = shares[0];
            // It might be a JSON string or an object depending on how frontend sends it
            // Frontend sends stringify value in 'shares' array
            clientShareData = typeof shareRaw === 'string' ? JSON.parse(shareRaw) : shareRaw;
        } catch (e) {
            return res.status(400).json({ success: false, error: 'Invalid share format. Must be JSON.' });
        }

        if (!clientShareData.share || !clientShareData.index) {
            return res.status(400).json({ success: false, error: 'Invalid share content. Missing share or index.' });
        }

        // 2. Retrieve Server Share (B)
        const serverShareHex = await ShareStore.getShare(sender);
        if (!serverShareHex) {
            return res.status(400).json({
                success: false,
                error: 'Server share not found for this address.'
            });
        }

        // 3. Prepare Transaction to Sign
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        const feeData = await provider.getFeeData();
        const nonce = await provider.getTransactionCount(sender, 'pending');

        const tx = EthTransaction.from({
            to,
            value: ethers.parseEther(String(value)),
            nonce,
            gasLimit: 21000,
            gasPrice: feeData.gasPrice,
            chainId: 11155111 // Sepolia
        });

        const unsignedTxHash = tx.unsignedHash;

        // 4. Perform TSS Signing (Lagrange Interpolation)
        // Combine Client Share (A or C) + Server Share (B)
        console.log(`[TSS] Signing with Index ${clientShareData.index} (Client) and Index 2 (Server)`);

        const signature = TSSSession.sign(
            unsignedTxHash,
            serverShareHex,
            clientShareData.share,
            clientShareData.index
        );

        // 5. Attach Signature
        tx.signature = {
            r: signature.r,
            s: signature.s,
            v: signature.v
        };

        // 6. Broadcast
        console.log('[TSS] Broadcasting signed transaction...');
        const serializedTx = tx.serialized;
        const broadcastResponse = await provider.broadcastTransaction(serializedTx);
        console.log(`[TSS] Transaction Sent! Hash: ${broadcastResponse.hash}`);

        res.json({
            success: true,
            txHash: broadcastResponse.hash,
            explorerUrl: `https://sepolia.etherscan.io/tx/${broadcastResponse.hash}`
        });

    } catch (error: any) {
        console.error('[TSS] Transaction Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send transaction'
        });
    }
};

export const getTransactionHistory = async (req: Request, res: Response) => {
    try {
        const { address } = req.query;

        if (!address || typeof address !== 'string' || !ethers.isAddress(address)) {
            return res.status(400).json({ success: false, error: 'Valid address is required' });
        }

        // Use Etherscan V2 API (Unified Endpoint)
        // Chain ID for Sepolia is 11155111
        const apiKey = process.env.ETHERSCAN_API_KEY || '';
        console.log(`[DEBUG] Etherscan API Key: ${apiKey ? 'Present (' + apiKey.substring(0, 4) + '...)' : 'MISSING'}`);

        const url = `https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;

        // Helper for retry logic
        const fetchWithRetry = async (url: string, retries = 3, timeout = 15000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), timeout);

                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(id);

                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return await response.json();
                } catch (err) {
                    if (i === retries - 1) throw err;
                    console.log(`Retrying history fetch (${i + 1}/${retries})...`);
                    await new Promise(res => setTimeout(res, 1000)); // Wait 1s before retry
                }
            }
        };

        let data;
        try {
            data = await fetchWithRetry(url);
        } catch (fetchError: any) {
            console.error('Etherscan fetch failed:', fetchError.message);
            return res.json({
                success: true,
                data: [],
                warning: 'Could not fetch history (Network Timeout). Please try again later.'
            });
        }

        if (data.status !== '1' && data.message !== 'No transactions found') {
            if (data.message === 'No transactions found') {
                return res.json({ success: true, data: [] });
            }
            throw new Error(data.result || 'Failed to fetch history from Etherscan');
        }

        const history = data.result || [];

        // Map to clean format
        const formattedHistory = history.map((tx: any) => ({
            hash: tx.hash,
            to: tx.to,
            from: tx.from,
            value: ethers.formatEther(tx.value),
            timestamp: new Date(parseInt(tx.timeStamp) * 1000).toLocaleString(),
            blockNumber: tx.blockNumber,
            nonce: tx.nonce,
            gasLimit: tx.gas,
            gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : 'N/A',
            gasUsed: tx.gasUsed,
            fee: ethers.formatEther(BigInt(tx.gasUsed) * BigInt(tx.gasPrice)),
            status: tx.txreceipt_status === '1' ? 'Success' : 'Failed',
            method: tx.functionName || 'Transfer',
            direction: tx.from.toLowerCase() === address.toLowerCase() ? 'Out' : 'In'
        }));

        res.json({
            success: true,
            data: formattedHistory
        });

    } catch (error: any) {
        console.error('History fetch error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch history'
        });
    }
};
