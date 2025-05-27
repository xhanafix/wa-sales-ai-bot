// app.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

// --- Constants & Configuration ---
const BOT_NAME = process.env.BOT_NAME || "Sales Assistant";
const MODEL_NAME = 'deepseek/deepseek-chat-v3-0324:free';
const MODEL_IDENTITY = 'DeepSeek Chat';
const API_KEY = process.env.OPENROUTER_API_KEY;

// Admin Configuration
const ADMIN_NUMBERS = process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : [];

// Lead Categories
const LEAD_CATEGORIES = {
    HOT: 'HOT',           // Ready to buy
    WARM: 'WARM',         // Interested but needs more info
    COLD: 'COLD',         // Just browsing
    INQUIRY: 'INQUIRY',   // General questions
    COMPLETED: 'COMPLETED' // Purchase completed
};

// Lead Status
const LEAD_STATUS = {
    NEW: 'NEW',
    CONTACTED: 'CONTACTED',
    NEGOTIATING: 'NEGOTIATING',
    QUALIFIED: 'QUALIFIED',
    CLOSED: 'CLOSED',
    LOST: 'LOST'
};

// AI Model Configuration from .env
const AI_MODEL = {
    id: process.env.AI_MODEL_ID || 'deepseek/deepseek-chat-v3-0324:free',
    name: process.env.AI_MODEL_NAME || 'DeepSeek Chat',
    description: process.env.AI_MODEL_DESCRIPTION || 'Model percuma dengan prestasi yang baik untuk perbualan umum'
};

// Default model configuration
let currentModel = AI_MODEL;

// Function to parse company info text file
function parseCompanyInfo() {
    try {
        const filePath = path.join(__dirname, 'company_info.txt');
        const content = fs.readFileSync(filePath, 'utf8');
        
        const info = {
            company: {},
            products: {},
            payment: {},
            shipping: {},
            return: {}
        };

        let currentSection = '';
        let currentProduct = null;

        const lines = content.split('\n');
        for (let line of lines) {
            line = line.trim();
            
            // Skip empty lines
            if (!line) continue;

            // Check for section headers
            if (line.startsWith('#')) {
                currentSection = line.replace('#', '').trim();
                continue;
            }

            // Check for product headers
            if (line.startsWith('[') && line.endsWith(']')) {
                currentProduct = line.slice(1, -1).toLowerCase();
                info.products[currentProduct] = {
                    name: '',
                    price: '',
                    features: [],
                    description: ''
                };
                continue;
            }

            // Parse content based on current section
            if (currentSection === 'COMPANY INFORMATION') {
                const [key, value] = line.split(':').map(s => s.trim());
                info.company[key.toLowerCase()] = value;
            }
            else if (currentSection === 'PAYMENT INFORMATION') {
                if (line.startsWith('-')) {
                    if (!info.payment.methods) info.payment.methods = [];
                    info.payment.methods.push(line.slice(1).trim());
                }
            }
            else if (currentSection === 'PRODUCTS' && currentProduct) {
                if (line.startsWith('NAME:')) {
                    info.products[currentProduct].name = line.split(':')[1].trim();
                }
                else if (line.startsWith('PRICE:')) {
                    info.products[currentProduct].price = line.split(':')[1].trim();
                }
                else if (line.startsWith('FEATURES:')) {
                    // Features section starts
                }
                else if (line.startsWith('-')) {
                    info.products[currentProduct].features.push(line.slice(1).trim());
                }
                else if (line.startsWith('DESCRIPTION:')) {
                    info.products[currentProduct].description = line.split(':')[1].trim();
                }
            }
            else if (currentSection === 'SHIPPING INFORMATION') {
                if (line.startsWith('-')) {
                    if (!info.shipping.methods) info.shipping.methods = [];
                    info.shipping.methods.push(line.slice(1).trim());
                }
                else if (line.startsWith('SHIPPING_FEE:')) {
                    info.shipping.fee = line.split(':')[1].trim();
                }
            }
            else if (currentSection === 'RETURN POLICY') {
                if (line.startsWith('RETURN_DAYS:')) {
                    info.return.days = line.split(':')[1].trim();
                }
                else if (line.startsWith('-')) {
                    if (!info.return.conditions) info.return.conditions = [];
                    info.return.conditions.push(line.slice(1).trim());
                }
            }
        }

        return info;
    } catch (error) {
        console.error('Ralat membaca fail maklumat syarikat:', error);
        return null;
    }
}

// Load company information
const COMPANY_INFO = parseCompanyInfo();
if (!COMPANY_INFO) {
    console.error("Ralat: Gagal memuatkan maklumat syarikat!");
    process.exit(1);
}

// System Prompt (Sales Representative Persona)
const SYSTEM_PROMPT = `Anda adalah wakil jualan profesional untuk ${COMPANY_INFO.company.company_name}. Nama anda adalah ${BOT_NAME}. Anda menggunakan model ${AI_MODEL.name}. 

Peranan anda:
1. Memperkenalkan dan mempromosikan produk kami dengan profesional
2. Menjawab soalan tentang produk dengan tepat dan informatif
3. Mengendalikan pertanyaan harga dan promosi
4. Mengumpul maklumat pelanggan yang berminat
5. Mengikuti prosedur jualan yang betul

MAKLUMAT SYARIKAT:
- Nama: ${COMPANY_INFO.company.company_name}
- Lokasi: ${COMPANY_INFO.company.office_location}
- Telefon: ${COMPANY_INFO.company.phone_number}
- Email: ${COMPANY_INFO.company.email}
- Waktu Perniagaan: ${COMPANY_INFO.company.business_hours}

PENTING: Anda HANYA BOLEH mempromosikan produk yang disenaraikan dalam sistem. JANGAN mencipta atau menambah produk yang tidak wujud. Produk yang tersedia adalah:

${Object.entries(COMPANY_INFO.products).map(([key, product]) => 
    `- ${product.name} (${product.price})
     Ciri-ciri: ${product.features.join(', ')}
     Penerangan: ${product.description}`
).join('\n\n')}

MAKLUMAT PEMBAYARAN:
${COMPANY_INFO.payment.methods.map(method => `- ${method}`).join('\n')}

MAKLUMAT PENGHANTARAN:
${COMPANY_INFO.shipping.methods.map(method => `- ${method}`).join('\n')}
Yuran Penghantaran: ${COMPANY_INFO.shipping.fee}

POLISI PULANGAN:
- Tempoh Pulangan: ${COMPANY_INFO.return.days}
${COMPANY_INFO.return.conditions.map(condition => `- ${condition}`).join('\n')}

Garis panduan komunikasi:
- Gunakan bahasa yang profesional tetapi mesra
- Fokus pada manfaat produk untuk pelanggan
- Berikan jawapan yang tepat dan jujur
- Jika tidak tahu jawapan, akui dan janji untuk mendapatkan maklumat
- Jangan berikan harga atau promosi yang tidak tepat
- Sentiasa bersikap positif dan membantu
- JANGAN mencipta atau menambah produk yang tidak disenaraikan di atas

Format jawapan:
- Gunakan poin untuk senarai ciri-ciri
- Berikan contoh praktikal bila sesuai
- Akhiri dengan call-to-action yang sesuai
- Rujuk hanya produk yang disenaraikan di atas

Jangan akhiri perbualan dengan soalan kecuali jika diperlukan untuk penjelasan atau untuk mengumpul maklumat pelanggan.`;

const INITIAL_BOT_MESSAGE = `Hai! Saya ${BOT_NAME}, wakil jualan ${COMPANY_INFO.company.company_name}. Saya boleh membantu anda dengan maklumat tentang produk kami. Produk apa yang anda minat untuk ketahui?`;

// --- Validasi Konfigurasi ---
if (!API_KEY) {
    console.error("Ralat: OPENROUTER_API_KEY tidak dijumpai dalam fail .env!");
    process.exit(1);
}

// --- OpenRouter API Setup ---
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

console.log(`Menggunakan model AI: ${AI_MODEL.name}`);

// --- WhatsApp Client Setup ---
console.log("Memulakan inisialisasi klien WhatsApp...");
const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

// Menyimpan riwayat chat dan maklumat pelanggan
const chatHistories = new Map();
const customerInfo = new Map();

// Add payment QR code configuration
const PAYMENT_QR = {
    path: './assets/payment-qr.png', // Path to your QR code image
    caption: 'QR Code Pembayaran'
};

// Add payment-related keywords
const PAYMENT_KEYWORDS = [
    'nak beli',
    'mahu beli',
    'beli',
    'pembayaran',
    'bayar',
    'harga',
    'kos',
    'payment',
    'buy',
    'purchase'
];

// Function to check if message indicates purchase interest
function isPurchaseInterest(message) {
    const lowerMessage = message.toLowerCase();
    return PAYMENT_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

// Function to send payment QR code
async function sendPaymentQR(sender) {
    try {
        const media = MessageMedia.fromFilePath(PAYMENT_QR.path);
        await client.sendMessage(sender, media, { 
            caption: `${PAYMENT_QR.caption}\n\nSila imbaskan QR code ini untuk membuat pembayaran. Selepas pembayaran, sila hantar bukti pembayaran untuk pengesahan.`
        });
    } catch (error) {
        console.error('Ralat menghantar QR code pembayaran:', error);
        await client.sendMessage(sender, 'Maaf, QR code pembayaran tidak dapat dihantar pada masa ini.');
    }
}

// Fungsi untuk mengumpul maklumat pelanggan
async function collectCustomerInfo(sender, message) {
    let info = customerInfo.get(sender) || {};
    
    if (!info.name && message.toLowerCase().includes('nama saya')) {
        info.name = message.split('nama saya')[1].trim();
        customerInfo.set(sender, info);
        return `Terima kasih ${info.name}! Boleh saya tahu nombor telefon anda?`;
    }
    
    if (!info.phone && message.match(/\d+/)) {
        info.phone = message.match(/\d+/)[0];
        customerInfo.set(sender, info);
        return `Terima kasih! Boleh saya tahu alamat email anda?`;
    }
    
    if (!info.email && message.includes('@')) {
        info.email = message;
        customerInfo.set(sender, info);
        return `Terima kasih! Maklumat anda telah direkodkan. Ada yang lain yang saya boleh bantu?`;
    }
    
    return null;
}

// CRM Functions
function loadLeads() {
    try {
        const leadsPath = path.join(__dirname, 'leads.json');
        const data = fs.readFileSync(leadsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Ralat memuatkan data leads:', error);
        return { leads: [] };
    }
}

function saveLeads(leadsData) {
    try {
        const leadsPath = path.join(__dirname, 'leads.json');
        fs.writeFileSync(leadsPath, JSON.stringify(leadsData, null, 2));
    } catch (error) {
        console.error('Ralat menyimpan data leads:', error);
    }
}

function getLeadByPhone(phone) {
    const leadsData = loadLeads();
    return leadsData.leads.find(lead => lead.phone === phone);
}

function createOrUpdateLead(phone, info = {}) {
    const leadsData = loadLeads();
    const existingLead = leadsData.leads.find(lead => lead.phone === phone);
    
    if (existingLead) {
        // Update existing lead
        Object.assign(existingLead, {
            ...info,
            lastContact: new Date().toISOString(),
            interactionCount: (existingLead.interactionCount || 0) + 1
        });
    } else {
        // Create new lead
        leadsData.leads.push({
            phone,
            ...info,
            category: LEAD_CATEGORIES.COLD,
            status: LEAD_STATUS.NEW,
            createdAt: new Date().toISOString(),
            lastContact: new Date().toISOString(),
            interactionCount: 1,
            interactions: []
        });
    }
    
    saveLeads(leadsData);
    return getLeadByPhone(phone);
}

function updateLeadCategory(phone, category) {
    const leadsData = loadLeads();
    const lead = leadsData.leads.find(lead => lead.phone === phone);
    
    if (lead) {
        lead.category = category;
        saveLeads(leadsData);
    }
}

function updateLeadStatus(phone, status) {
    const leadsData = loadLeads();
    const lead = leadsData.leads.find(lead => lead.phone === phone);
    
    if (lead) {
        lead.status = status;
        saveLeads(leadsData);
    }
}

function addInteraction(phone, message, type = 'CHAT') {
    const leadsData = loadLeads();
    const lead = leadsData.leads.find(lead => lead.phone === phone);
    
    if (lead) {
        if (!lead.interactions) {
            lead.interactions = [];
        }
        
        lead.interactions.push({
            type,
            message,
            timestamp: new Date().toISOString()
        });
        
        saveLeads(leadsData);
    }
}

// Function to analyze message and determine lead category
function analyzeLeadCategory(message, lead) {
    const lowerMessage = message.toLowerCase();
    
    // Check for purchase intent
    if (lowerMessage.includes('nak beli') || 
        lowerMessage.includes('mahu beli') || 
        lowerMessage.includes('berapa harga') ||
        lowerMessage.includes('macam mana nak bayar')) {
        return LEAD_CATEGORIES.HOT;
    }
    
    // Check for product interest
    if (lowerMessage.includes('ciri') || 
        lowerMessage.includes('spesifikasi') || 
        lowerMessage.includes('fungsi') ||
        lowerMessage.includes('boleh tolong terangkan')) {
        return LEAD_CATEGORIES.WARM;
    }
    
    // Check for general inquiry
    if (lowerMessage.includes('boleh tanya') || 
        lowerMessage.includes('macam mana') || 
        lowerMessage.includes('ada tak')) {
        return LEAD_CATEGORIES.INQUIRY;
    }
    
    // If lead has shown previous interest
    if (lead && lead.interactionCount > 3) {
        return LEAD_CATEGORIES.WARM;
    }
    
    return LEAD_CATEGORIES.COLD;
}

// Function to check if user is admin
function isAdmin(phone) {
    return ADMIN_NUMBERS.includes(phone);
}

// Add schedule for daily summary
function scheduleDailySummary() {
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // tomorrow
        0, 0, 0 // 00:00:00
    );
    const timeToMidnight = night.getTime() - now.getTime();

    // Schedule the first summary
    setTimeout(() => {
        sendDailySummary();
        // Schedule subsequent summaries every 24 hours
        setInterval(sendDailySummary, 24 * 60 * 60 * 1000);
    }, timeToMidnight);
}

// Function to generate daily summary
async function sendDailySummary() {
    try {
        const leadsData = loadLeads();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Filter leads that had interactions in the last 24 hours
        const recentLeads = leadsData.leads.filter(lead => {
            const lastContact = new Date(lead.lastContact);
            return lastContact >= yesterday && lastContact <= today;
        });

        // Generate summary message
        let summaryMessage = `📊 Laporan Harian Leads (${today.toLocaleDateString('ms-MY')})\n\n`;

        // Overall statistics
        summaryMessage += `📈 Statistik Keseluruhan:\n`;
        summaryMessage += `Jumlah Leads: ${leadsData.leads.length}\n`;
        summaryMessage += `Hot Leads: ${leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.HOT).length}\n`;
        summaryMessage += `Warm Leads: ${leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.WARM).length}\n`;
        summaryMessage += `Cold Leads: ${leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.COLD).length}\n`;
        summaryMessage += `Selesai: ${leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.COMPLETED).length}\n\n`;

        // Recent activity
        summaryMessage += `🔄 Aktiviti 24 Jam Terakhir:\n`;
        summaryMessage += `Leads Aktif: ${recentLeads.length}\n\n`;

        // List recent leads with their status
        if (recentLeads.length > 0) {
            summaryMessage += `📝 Senarai Leads Aktif:\n`;
            recentLeads.forEach(lead => {
                summaryMessage += `\n📱 ${lead.phone}\n`;
                summaryMessage += `Status: ${lead.status}\n`;
                summaryMessage += `Kategori: ${lead.category}\n`;
                summaryMessage += `Interaksi: ${lead.interactionCount}\n`;
                
                // Get last message
                if (lead.interactions && lead.interactions.length > 0) {
                    const lastInteraction = lead.interactions[lead.interactions.length - 1];
                    summaryMessage += `Mesej Terakhir: ${lastInteraction.message.substring(0, 50)}${lastInteraction.message.length > 50 ? '...' : ''}\n`;
                }
            });
        }

        // Send to all admin numbers
        for (const adminNumber of ADMIN_NUMBERS) {
            try {
                await client.sendMessage(adminNumber, summaryMessage);
                console.log(`Laporan harian dihantar ke ${adminNumber}`);
            } catch (error) {
                console.error(`Ralat menghantar laporan ke ${adminNumber}:`, error);
            }
        }
    } catch (error) {
        console.error('Ralat menghantar laporan harian:', error);
    }
}

// Function to switch AI model
function switchModel(modelKey) {
    if (AI_MODEL.id === modelKey) {
        return true;
    }
    return false;
}

// Function to get model list message
function getModelListMessage() {
    let message = '📱 Senarai Model AI yang Tersedia:\n\n';
    message += `${AI_MODEL.id}:\n`;
    message += `Nama: ${AI_MODEL.name}\n`;
    message += `Penerangan: ${AI_MODEL.description}\n`;
    message += `Status: ${AI_MODEL.id === AI_MODEL.id ? '✅ Aktif' : '⏳ Tidak Aktif'}\n\n`;
    return message;
}

// --- WhatsApp Event Handlers ---

client.on('qr', (qr) => {
    console.log('Kod QR diterima, imbaskan menggunakan WhatsApp di telefon anda:');
    qrcode.generate(qr, { small: true }); // Tampilkan QR code di terminal
});

client.on('authenticated', () => {
    console.log('Pengesahan berjaya!');
});

client.on('auth_failure', msg => {
    console.error('Pengesahan GAGAL:', msg);
    process.exit(1); // Keluar jika pengesahan gagal
});

client.on('ready', () => {
    console.log(`Klien WhatsApp sedia! Berhubung sebagai ${BOT_NAME}.`);
    console.log('Memulakan jadual laporan harian...');
    scheduleDailySummary();
});

client.on('message', async (message) => {
    const sender = message.from;
    const messageBody = message.body;

    // Log pesan yang diterima
    let receivedMessageLog = `Mesej diterima dari ${sender}: `;
    if (message.hasMedia) {
        receivedMessageLog += `[MEDIA]`;
        if (messageBody) {
            receivedMessageLog += ` Kapsyen: "${messageBody}"`;
        }
    } else if (messageBody) {
        receivedMessageLog += `"${messageBody}"`;
    } else {
        receivedMessageLog += "[MESEJ KOSONG atau JENIS TIDAK DIKENALI]";
    }
    console.log(receivedMessageLog);

    // Abaikan pesan jika tidak ada body teks DAN tidak ada media, atau itu status, atau dari bot sendiri
    if ((!messageBody && !message.hasMedia) || message.isStatus || message.fromMe) {
        console.log("Mesej diabaikan (tiada kandungan, status, atau dari bot sendiri).");
        return;
    }

    // Handle specific commands
    if (messageBody) {
        const lowerMessage = messageBody.toLowerCase();
        
        if (lowerMessage === '/ping') {
            await message.reply('Pong!');
            return;
        }
        
        if (lowerMessage === '/products') {
            let productList = "Senarai Produk Kami:\n\n";
            for (const [key, product] of Object.entries(COMPANY_INFO.products)) {
                productList += `${product.name} - ${product.price}\n`;
            }
            await message.reply(productList);
            return;
        }
        
        if (lowerMessage.startsWith('/product ')) {
            const productKey = lowerMessage.split(' ')[1];
            const product = COMPANY_INFO.products[productKey];
            if (product) {
                let productInfo = `${product.name}\n`;
                productInfo += `Harga: ${product.price}\n\n`;
                productInfo += `Ciri-ciri:\n${product.features.map(f => `- ${f}`).join('\n')}\n\n`;
                productInfo += `Penerangan:\n${product.description}`;
                await message.reply(productInfo);
                return;
            }
        }

        // Add payment command
        if (lowerMessage === '/payment') {
            try {
                const media = MessageMedia.fromFilePath(PAYMENT_QR.path);
                await client.sendMessage(sender, media, { caption: PAYMENT_QR.caption });
                return;
            } catch (error) {
                console.error('Ralat menghantar QR code pembayaran:', error);
                await message.reply('Maaf, QR code pembayaran tidak dapat dihantar pada masa ini.');
                return;
            }
        }

        // CRM Commands (Admin Only)
        if (lowerMessage === '/leads' || lowerMessage === '/leadstats') {
            if (!isAdmin(sender)) {
                await message.reply('Maaf, anda tidak mempunyai akses untuk melihat maklumat ini.');
                return;
            }

            if (lowerMessage === '/leads') {
                const leadsData = loadLeads();
                const lead = getLeadByPhone(sender);
                
                if (lead) {
                    let leadInfo = `Maklumat Lead:\n\n`;
                    leadInfo += `Status: ${lead.status}\n`;
                    leadInfo += `Kategori: ${lead.category}\n`;
                    leadInfo += `Bilangan Interaksi: ${lead.interactionCount}\n`;
                    leadInfo += `Tarikh Mula: ${new Date(lead.createdAt).toLocaleDateString('ms-MY')}\n`;
                    leadInfo += `Interaksi Terakhir: ${new Date(lead.lastContact).toLocaleDateString('ms-MY')}\n`;
                    
                    await message.reply(leadInfo);
                    return;
                }
            }
            
            if (lowerMessage === '/leadstats') {
                const leadsData = loadLeads();
                const stats = {
                    total: leadsData.leads.length,
                    hot: leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.HOT).length,
                    warm: leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.WARM).length,
                    cold: leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.COLD).length,
                    completed: leadsData.leads.filter(l => l.category === LEAD_CATEGORIES.COMPLETED).length
                };
                
                let statsMessage = `Statistik Leads:\n\n`;
                statsMessage += `Jumlah Leads: ${stats.total}\n`;
                statsMessage += `Hot Leads: ${stats.hot}\n`;
                statsMessage += `Warm Leads: ${stats.warm}\n`;
                statsMessage += `Cold Leads: ${stats.cold}\n`;
                statsMessage += `Selesai: ${stats.completed}\n`;
                
                await message.reply(statsMessage);
                return;
            }
        }

        // Add new admin command to view specific lead
        if (lowerMessage.startsWith('/viewlead ')) {
            if (!isAdmin(sender)) {
                await message.reply('Maaf, anda tidak mempunyai akses untuk melihat maklumat ini.');
                return;
            }

            const targetPhone = lowerMessage.split(' ')[1];
            const lead = getLeadByPhone(targetPhone);
            
            if (lead) {
                let leadInfo = `Maklumat Lead untuk ${targetPhone}:\n\n`;
                leadInfo += `Status: ${lead.status}\n`;
                leadInfo += `Kategori: ${lead.category}\n`;
                leadInfo += `Bilangan Interaksi: ${lead.interactionCount}\n`;
                leadInfo += `Tarikh Mula: ${new Date(lead.createdAt).toLocaleDateString('ms-MY')}\n`;
                leadInfo += `Interaksi Terakhir: ${new Date(lead.lastContact).toLocaleDateString('ms-MY')}\n`;
                
                if (lead.interactions && lead.interactions.length > 0) {
                    leadInfo += `\nInteraksi Terakhir:\n`;
                    const lastInteractions = lead.interactions.slice(-3); // Show last 3 interactions
                    lastInteractions.forEach(interaction => {
                        leadInfo += `[${new Date(interaction.timestamp).toLocaleString('ms-MY')}] ${interaction.message}\n`;
                    });
                }
                
                await message.reply(leadInfo);
                return;
            } else {
                await message.reply('Lead tidak dijumpai.');
                return;
            }
        }

        // Add model switching commands (Admin Only)
        if (lowerMessage === '/models') {
            if (!isAdmin(sender)) {
                await message.reply('Maaf, anda tidak mempunyai akses untuk melihat maklumat ini.');
                return;
            }
            await message.reply(getModelListMessage());
            return;
        }

        if (lowerMessage.startsWith('/switchmodel ')) {
            if (!isAdmin(sender)) {
                await message.reply('Maaf, anda tidak mempunyai akses untuk menukar model.');
                return;
            }

            const modelKey = lowerMessage.split(' ')[1].toUpperCase();
            if (switchModel(modelKey)) {
                await message.reply(`Model AI telah ditukar ke ${AI_MODEL.name}`);
                console.log(`Model AI ditukar ke ${AI_MODEL.name} oleh ${sender}`);
            } else {
                await message.reply('Model tidak dijumpai. Gunakan /models untuk melihat senarai model yang tersedia.');
            }
            return;
        }
    }

    // Dapatkan atau inisialisasi riwayat chat
    let userHistory = chatHistories.get(sender);
    if (!userHistory) {
        console.log(`Memulakan riwayat chat baru untuk ${sender}`);
        userHistory = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "assistant", content: INITIAL_BOT_MESSAGE }
        ];
        chatHistories.set(sender, userHistory);
    }

    // Persiapkan konteks waktu
    const now = new Date();
    const formattedDateTime = now.toLocaleString('ms-MY', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    });

    try {
        let userMessage = '';
        
        if (message.hasMedia) {
            const media = await message.downloadMedia();
            if (media && media.mimetype.startsWith('image/')) {
                console.log(`Mesej dari ${sender} mengandungi imej (${media.mimetype}). Kapsyen: "${messageBody || ''}"`);
                await message.reply("Maaf, ciri imej belum disokong dengan model ini. Sila hantar mesej teks sahaja.");
                return;
            } else {
                console.log(`Mesej dari ${sender} mengandungi media bukan imej (${media.mimetype}). Ini akan diabaikan untuk pemprosesan AI.`);
                await message.reply("Maaf, saya hanya boleh memproses mesej teks pada masa ini.");
                return;
            }
        } else if (messageBody) {
            userMessage = `(Maklumat masa semasa: ${formattedDateTime})\nMesej Pengguna:\n${messageBody}`;
            
            // CRM: Get or create lead
            const lead = createOrUpdateLead(sender, {
                lastMessage: messageBody
            });
            
            // CRM: Add interaction
            addInteraction(sender, messageBody);
            
            // CRM: Analyze and update category
            const newCategory = analyzeLeadCategory(messageBody, lead);
            updateLeadCategory(sender, newCategory);
            
            // CRM: Update status based on category
            if (newCategory === LEAD_CATEGORIES.HOT) {
                updateLeadStatus(sender, LEAD_STATUS.NEGOTIATING);
            } else if (newCategory === LEAD_CATEGORIES.WARM) {
                updateLeadStatus(sender, LEAD_STATUS.QUALIFIED);
            }
            
            // Check for purchase interest and send payment QR
            if (isPurchaseInterest(messageBody)) {
                await sendPaymentQR(sender);
                updateLeadStatus(sender, LEAD_STATUS.NEGOTIATING);
            }
        } else {
            console.log("Mesej tanpa teks dan tanpa media dikesan selepas penapis awal, diabaikan.");
            return;
        }

        // Check for customer information collection
        const customerResponse = await collectCustomerInfo(sender, messageBody);
        if (customerResponse) {
            await message.reply(customerResponse);
            return;
        }

        // Set status 'typing'
        const chat = await client.getChatById(sender);
        await chat.sendStateTyping();

        // Add user message to history
        userHistory.push({ role: "user", content: userMessage });

        // Update the API request to use model from .env
        const requestData = {
            model: AI_MODEL.id,
            messages: userHistory,
            temperature: 0.7,
            max_tokens: 1000
        };

        console.log(`Menghantar ke AI (${AI_MODEL.name}) untuk ${sender}: "${userMessage.substring(0, 100)}..."`);

        const response = await axios.post(OPENROUTER_API_URL, requestData, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/yourusername/gemma-wa-bot',
                'X-Title': 'WhatsApp Sales Bot'
            }
        });

        // Stop typing status
        await chat.clearState();

        if (response.data && response.data.choices && response.data.choices[0]) {
            const botReplyText = response.data.choices[0].message.content;

            if (botReplyText) {
                console.log(`Jawapan AI untuk ${sender}: "${botReplyText.substring(0, 100)}..."`);

                // Send reply to WhatsApp
                await client.sendMessage(sender, botReplyText);

                // Update chat history
                userHistory.push({ role: "assistant", content: botReplyText });
                chatHistories.set(sender, userHistory);

            } else {
                console.warn(`AI tidak menghasilkan teks untuk ${sender}.`);
                await client.sendMessage(sender, "Maaf, saya tidak boleh memberikan jawapan untuk itu.");
            }
        } else {
            console.error(`Jawapan AI kosong diterima untuk ${sender}.`);
            await client.sendMessage(sender, "Maaf, telah berlaku ralat semasa memproses permintaan anda.");
        }

    } catch (error) {
        console.error(`Ralat semasa berinteraksi dengan AI atau WhatsApp untuk ${sender}:`, error);
        try {
            const chat = await client.getChatById(sender);
            await chat.clearState();
            await client.sendMessage(sender, `Wah, nampaknya ada sedikit gangguan dalam sistem saya. Cuba lagi nanti ya.\n\n(Butiran ralat: ${error.message || 'Ralat tidak diketahui'})`);
        } catch (sendError) {
            console.error(`Gagal menghantar mesej ralat ke ${sender}:`, sendError);
        }
    }
});

// --- Inisialisasi Klien ---
console.log("Memulakan sambungan ke WhatsApp...");
client.initialize();

// --- Penanganan Proses Exit ---
process.on('SIGINT', async () => {
    console.log("\nMenutup sambungan WhatsApp...");
    await client.destroy();
    console.log("Sambungan ditutup. Selamat tinggal!");
    process.exit(0);
});
