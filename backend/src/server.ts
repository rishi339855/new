import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import walletRoutes from './routes/walletRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mpc_wallet';

console.log('[DEBUG] Attempting MongoDB Connection to:', MONGO_URI);

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        console.error('   -> Check if mongod is running on port 27017');
        console.error('   -> Try replacing "localhost" with "127.0.0.1" in .env');
    });


// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', walletRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug 404
app.use((req, res, next) => {
    console.log(`404 Not Found: ${req.method} ${req.url}`);
    next();
});

// Start Server
// Start Server
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeSocketIO } from './services/socketService';

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

// Initialize Socket Logic
initializeSocketIO(io);

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
// Force restart
