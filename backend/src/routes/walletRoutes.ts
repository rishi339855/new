import { Router } from 'express';
import { createWallet, checkBalance, sendTransaction, getTransactionHistory } from '../controllers/walletController';

const router = Router();

router.post('/create-wallet', createWallet);
router.post('/send-transaction', sendTransaction);
router.get('/check-balance', checkBalance);
router.get('/history', getTransactionHistory);

export default router;
