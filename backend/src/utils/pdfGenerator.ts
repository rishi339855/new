import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

interface WalletData {
    address: string;
    publicKey: string;
    privateKey: string;
    shares: string[];
}

export const generateWalletPDF = async (data: WalletData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                // Initialize Doc with a slightly cleaner buffer logic
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // --- CONSTANTS ---
                const PAGE_WIDTH = doc.page.width - 100; // 50 margin * 2
                const CONTENT_START_X = 50;
                const COLOR_PRIMARY = '#4f46e5'; // Indigo
                const COLOR_TEXT = '#1f2937';    // Dark Gray
                const COLOR_MUTED = '#6b7280';   // Light Gray

                // --- HEADER ---
                doc.rect(0, 0, doc.page.width, 100).fill('#f3f4f6'); // Light header bg
                doc.fontSize(24).font('Helvetica-Bold').fillColor(COLOR_PRIMARY).text('MPC Wallet Backup', 50, 40);

                doc.fontSize(10).font('Helvetica').fillColor(COLOR_TEXT)
                    .text('CONFIDENTIAL DOCUMENT', 50, 45, { align: 'right' });

                doc.moveDown(2.5); // Move out of header

                // --- INTRO TEXT ---
                doc.fontSize(10).font('Helvetica').fillColor(COLOR_TEXT)
                    .text('This document contains your secure wallet credentials. Please print this document and store it in a secure, offline location (e.g., a safety deposit box).', {
                        width: PAGE_WIDTH,
                        align: 'left'
                    });
                doc.moveDown(2);

                // --- SECTION 1: WALLET IDENTIFIERS ---
                doc.fontSize(14).font('Helvetica-Bold').fillColor(COLOR_PRIMARY).text('1. Wallet Identity');
                doc.moveDown(0.5);

                // Draw a light container for address/pubkey
                const startIdentityY = doc.y;

                // Calculate height needed for public key to wrap safely
                const pubKeyHeight = doc.font('Courier').fontSize(9).heightOfString(data.publicKey, { width: PAGE_WIDTH - 20 });
                const identityBoxHeight = 40 + pubKeyHeight + 40; // Padding + Address + PubKey

                doc.rect(CONTENT_START_X, startIdentityY, PAGE_WIDTH, identityBoxHeight).strokeColor('#e5e7eb').stroke();

                // Address
                let currentY = startIdentityY + 15;
                doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_MUTED).text('WALLET ADDRESS', CONTENT_START_X + 10, currentY);
                doc.fontSize(10).font('Courier').fillColor(COLOR_TEXT).text(data.address, CONTENT_START_X + 10, currentY + 15);

                // Public Key
                currentY += 40;
                doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_MUTED).text('PUBLIC KEY', CONTENT_START_X + 10, currentY);
                doc.fontSize(9).font('Courier').fillColor(COLOR_TEXT).text(data.publicKey, CONTENT_START_X + 10, currentY + 15, {
                    width: PAGE_WIDTH - 20,
                    align: 'justify'
                });

                doc.y = startIdentityY + identityBoxHeight + 30; // Move cursor below box

                // --- SECTION 2: SHAMIR SHARES ---
                doc.fontSize(14).font('Helvetica-Bold').fillColor(COLOR_PRIMARY).text('2. Recovery Shares (2-of-3)');
                doc.fontSize(10).font('Helvetica').fillColor(COLOR_MUTED).text('Scan these QR codes to recover your key. You need 2 out of 3 shares.');
                doc.moveDown(1);

                const shareLabels = ['Share A', 'Share B', 'Share C'];

                for (let i = 0; i < data.shares.length; i++) {
                    const share = data.shares[i];
                    const label = shareLabels[i];

                    // Generate QR
                    const qrDataURL = await QRCode.toDataURL(share, { margin: 1 });
                    const qrBuffer = Buffer.from(qrDataURL.split(',')[1], 'base64');

                    // Layout calculations
                    const qrSize = 80;
                    const padding = 15;
                    // Text width is page width minus QR size minus internal padding
                    const textWidth = PAGE_WIDTH - qrSize - (padding * 3);

                    // Calculate how tall the text block will be
                    const textHeight = doc.font('Courier').fontSize(9).heightOfString(share, { width: textWidth });

                    // The block height is determined by the taller element (Text vs QR) + padding
                    const blockHeight = Math.max(textHeight + 25, qrSize) + (padding * 2);

                    // Check for Page Break
                    if (doc.y + blockHeight > doc.page.height - 50) {
                        doc.addPage();
                        // Re-print section header if page breaks
                        doc.fontSize(14).font('Helvetica-Bold').fillColor(COLOR_PRIMARY).text('2. Recovery Shares (Cont.)');
                        doc.moveDown(1);
                    }

                    const blockStartY = doc.y;

                    // Draw Border for this share
                    doc.roundedRect(CONTENT_START_X, blockStartY, PAGE_WIDTH, blockHeight, 4).lineWidth(1).strokeColor('#e5e7eb').stroke();

                    // Label
                    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLOR_PRIMARY)
                        .text(label, CONTENT_START_X + padding, blockStartY + padding);

                    // Share Text (Monospace, wrapped)
                    doc.fontSize(9).font('Courier').fillColor(COLOR_TEXT)
                        .text(share, CONTENT_START_X + padding, blockStartY + padding + 20, {
                            width: textWidth,
                            align: 'left'
                        });

                    // QR Code (Right Aligned)
                    doc.image(qrBuffer, (CONTENT_START_X + PAGE_WIDTH) - qrSize - padding, blockStartY + padding + 5, {
                        width: qrSize,
                        height: qrSize
                    });

                    // Move cursor for next item
                    doc.y = blockStartY + blockHeight + 15;
                }

                doc.moveDown(1);


                // --- FOOTER ---
                const bottomOfPage = doc.page.height - 40;
                doc.fontSize(8).fillColor('#9ca3af').text(
                    `Generated at ${new Date().toISOString()}`,
                    50,
                    bottomOfPage,
                    { align: 'center', width: PAGE_WIDTH }
                );

                doc.end();

            } catch (error) {
                reject(error);
            }
        })();
    });
};