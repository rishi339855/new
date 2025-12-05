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

export const sendTransaction = async (req: Request, res: Response) => {
    try {
        const { shares, sender, to, value } = req.body;

        // Validation
        if (!shares || !Array.isArray(shares) || shares.length < 2) {
            return res.status(400).json({ success: false, error: 'At least 2 shares are required' });
        }
        if (!sender || !ethers.isAddress(sender)) {
            return res.status(400).json({ success: false, error: 'Valid sender address is required' });
        }
        if (!to || !ethers.isAddress(to)) {
            return res.status(400).json({ success: false, error: 'Valid receiver address is required' });
        }
        if (!value || isNaN(Number(value))) {
            return res.status(400).json({ success: false, error: 'Valid amount is required' });
        }

        // 1. Reconstruct Private Key
        const privateKey = reconstructKey(shares);

        // 2. Connect to Provider
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

        // 3. Create Wallet Instance
        const wallet = new ethers.Wallet(privateKey, provider);

        // 4. Verify Sender
        if (wallet.address.toLowerCase() !== sender.toLowerCase()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Shares: Reconstructed wallet address does not match sender address.'
            });
        }

        // Debug Logs
        const balance = await provider.getBalance(wallet.address);
        console.log(`[TX] Sender: ${wallet.address}`);
        console.log(`[TX] Balance: ${ethers.formatEther(balance)} ETH`);

        // 5. Get Nonce (including pending)
        const nonce = await provider.getTransactionCount(wallet.address, 'pending');
        console.log(`[TX] Nonce: ${nonce}`);

        // 6. Send Transaction
        console.log('[TX] Sending transaction...');
        const tx = await wallet.sendTransaction({
            to,
            value: ethers.parseEther(String(value)),
            nonce
        });
        console.log(`[TX] Sent! Hash: ${tx.hash}`);

        // 7. Respond with Hash
        res.json({
            success: true,
            txHash: tx.hash,
            explorerUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`
        });

    } catch (error: any) {
        console.error('[TX] Error:', error);
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
