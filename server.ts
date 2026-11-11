import express, { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'elhanaa_store_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface StoreDatabase {
  shopKey: string;
  storeInfo: {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    currency: string;
    footerMessage: string;
  };
  products: any[];
  sales: any[];
  customers: any[];
  debtPayments: any[];
  expenses: any[];
  trashItems: any[];
  deletedEntities?: Array<{ entityType: string; id: string; deletedAt: string }>;
  lastUpdated: string;
  version: number;
  masterInitialized?: boolean;
}

// Generate random secure token for store device pairing
function generateShopKey(): string {
  return 'hanaa_' + crypto.randomBytes(24).toString('hex');
}

// Initialize or read Database
function getDatabase(): StoreDatabase {
  if (!fs.existsSync(DB_FILE)) {
    const initialDb: StoreDatabase = {
      shopKey: generateShopKey(),
      storeInfo: {
        name: 'سوبيرات الهناء',
        tagline: 'تسيير المحل والمبيعات والمخزون',
        address: 'الجزائر العاصمة',
        phone: '0550 00 00 00',
        currency: 'دج',
        footerMessage: 'شكرًا لزيارتكم سوبيرات الهناء - نتشرف بخدمتكم دائمًا!',
      },
      products: [],
      sales: [],
      customers: [],
      debtPayments: [],
      expenses: [],
      trashItems: [],
      deletedEntities: [],
      lastUpdated: new Date().toISOString(),
      version: 1,
      masterInitialized: false,
    };
    saveDatabase(initialDb);
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    let migrated = false;
    if (!parsed.shopKey) { parsed.shopKey = generateShopKey(); migrated = true; }
    // Existing stores are treated as already initialized; only a brand-new DB
    // receives the one-time bootstrap response for its first trusted device.
    if (typeof parsed.masterInitialized !== 'boolean') { parsed.masterInitialized = true; migrated = true; }
    if (parsed.deletedEntities === undefined) { parsed.deletedEntities = []; migrated = true; }
    if (!Array.isArray(parsed.deletedEntities)) throw new Error('Invalid deletedEntities collection');
    if (migrated) saveDatabase(parsed);
    return parsed;
  } catch (err) {
    // Never replace a potentially recoverable store database with empty data.
    const recoveryCopy = `${DB_FILE}.corrupt-${Date.now()}.json`;
    try { fs.copyFileSync(DB_FILE, recoveryCopy, fs.constants.COPYFILE_EXCL); } catch (copyErr) {
      console.error('Could not create a recovery copy:', copyErr);
    }
    console.error(`Database JSON is invalid. Original file preserved; recovery copy: ${recoveryCopy}`, err);
    throw new Error('ملف بيانات المحل تالف. تم الحفاظ على الملف الأصلي وإيقاف عمليات البيانات لمنع فقدان المعلومات.');
  }
}

// Atomic save using temporary file to prevent corruption
function saveDatabase(data: StoreDatabase): void {
  data.lastUpdated = new Date().toISOString();
  data.version = (data.version || 0) + 1;
  const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const pairingAttempts = new Map<string, { count: number; resetAt: number }>();
const pairRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = pairingAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    pairingAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    next();
    return;
  }
  if (entry.count >= 12) {
    res.status(429).json({ success: false, message: 'محاولات ربط كثيرة. يرجى الانتظار 15 دقيقة.' });
    return;
  }
  entry.count += 1;
  next();
};

// Authorization middleware: Only paired devices with valid shopKey can access store API
const requireShopPairing = (req: Request, res: Response, next: NextFunction): void => {
  const db = getDatabase();
  const providedKey = req.headers['x-shop-key'] as string || req.query.shop_key as string;

  // Allow first-time pairing endpoint, pairing verification, and public status check
  const p = req.path;
  const orig = req.originalUrl;
  if (p === '/pair/info' && db.masterInitialized === false) return next();
  if (
    p === '/status' || p === '/pair/verify' ||
    orig.startsWith('/api/status') || orig.startsWith('/api/pair/verify')
  ) {
    return next();
  }

  if (!providedKey || providedKey !== db.shopKey) {
    res.status(401).json({
      error: 'UNAUTHORIZED_DEVICE',
      message: 'الجهاز غير مقترن بسوبيرات الهناء. يرجى مسح رمز QR من الجهاز المعتمد أولاً.',
    });
    return;
  }

  next();
};

// --- API Endpoints ---

// 1. Get pairing status / public store name
app.get('/api/status', (req: Request, res: Response) => {
  const db = getDatabase();
  const providedKey = (req.headers['x-shop-key'] as string) || (req.query.shop_key as string);
  const isPaired = providedKey === db.shopKey;

  res.json({
    online: true,
    storeName: db.storeInfo.name,
    isPaired,
    lastUpdated: db.lastUpdated,
    version: db.version,
    counts: {
      products: db.products.filter(p => !p.isDeleted).length,
      sales: db.sales.filter(s => !s.isDeleted).length,
      customers: db.customers.filter(c => !c.isDeleted).length,
    },
  });
});

// 2. Pair device with key
app.post('/api/pair/verify', pairRateLimit, (req: Request, res: Response) => {
  const { shopKey } = req.body;
  const db = getDatabase();

  const supplied = typeof shopKey === 'string' ? Buffer.from(shopKey) : Buffer.alloc(0);
  const expected = Buffer.from(db.shopKey);
  const validKey = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (validKey) {
    pairingAttempts.delete(req.ip || req.socket.remoteAddress || 'unknown');
    res.json({
      success: true,
      message: 'تم ربط الجهاز بنجاح مع سوبيرات الهناء!',
      shopKey: db.shopKey,
      storeInfo: db.storeInfo,
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'مفتاح الربط غير صالح أو تم تغييره.',
    });
  }
});

// Protected routes below
app.use('/api', requireShopPairing);

// 3. Get Full Shop Key & QR pairing data (for display on paired master device)
app.get('/api/pair/info', (req: Request, res: Response) => {
  const db = getDatabase();
  if (db.masterInitialized === false) {
    db.masterInitialized = true;
    saveDatabase(db);
  }
  res.json({
    shopKey: db.shopKey,
    storeInfo: db.storeInfo,
  });
});

// 4. Update Store Information
app.post('/api/settings/store', (req: Request, res: Response) => {
  const db = getDatabase();
  if (req.body.storeInfo) {
    db.storeInfo = { ...db.storeInfo, ...req.body.storeInfo };
    saveDatabase(db);
  }
  res.json({ success: true, storeInfo: db.storeInfo });
});

// 5. Pull Sync Data
app.get('/api/sync/pull', (req: Request, res: Response) => {
  const db = getDatabase();
  const since = req.query.since ? new Date(req.query.since as string).getTime() : 0;

  const filterSince = (items: any[]) => {
    if (!since) return items;
    return items.filter(item => {
      const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      return itemTime >= since;
    });
  };

  res.json({
    shopKey: db.shopKey,
    storeInfo: db.storeInfo,
    products: since ? filterSince(db.products) : db.products,
    sales: since ? filterSince(db.sales) : db.sales,
    customers: since ? filterSince(db.customers) : db.customers,
    debtPayments: since ? filterSince(db.debtPayments) : db.debtPayments,
    expenses: since ? filterSince(db.expenses) : db.expenses,
    trashItems: since ? filterSince(db.trashItems) : db.trashItems,
    deletedEntities: db.deletedEntities || [],
    lastUpdated: db.lastUpdated,
    serverTime: new Date().toISOString(),
    version: db.version,
  });
});

// 6. Push Sync Data with Conflict Resolution (Last-Write-Wins based on updatedAt)
app.post('/api/sync/push', (req: Request, res: Response) => {
  const db = getDatabase();
  const {
    products = [],
    sales = [],
    customers = [],
    debtPayments = [],
    expenses = [],
    trashItems = [],
    outboxQueue = [],
    storeInfo,
  } = req.body || {};

  const collections = { products, sales, customers, debtPayments, expenses, trashItems, outboxQueue };
  for (const [name, value] of Object.entries(collections)) {
    if (!Array.isArray(value)) {
      res.status(400).json({ success: false, message: `صيغة بيانات غير صالحة: ${name}` });
      return;
    }
    if (value.length > 100000) {
      res.status(413).json({ success: false, message: `عدد عناصر كبير جداً: ${name}` });
      return;
    }
  }

  const tombstones = db.deletedEntities || [];
  const mergeEntity = (serverList: any[], incomingList: any[], entityType: string): any[] => {
    const deletedIds = new Set(tombstones.filter(item => item.entityType === entityType).map(item => item.id));
    const map = new Map<string, any>();
    for (const item of serverList) {
      map.set(item.id, item);
    }
    for (const incoming of incomingList) {
      if (!incoming.id || deletedIds.has(incoming.id)) continue;
      const existing = map.get(incoming.id);
      if (!existing) {
        map.set(incoming.id, incoming);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
        if (incomingTime >= existingTime) {
          map.set(incoming.id, incoming);
        }
      }
    }
    return Array.from(map.values());
  };

  db.products = mergeEntity(db.products, products, 'product');
  db.sales = mergeEntity(db.sales, sales, 'sale');
  db.customers = mergeEntity(db.customers, customers, 'customer');
  db.debtPayments = mergeEntity(db.debtPayments, debtPayments, 'debtPayment');
  db.expenses = mergeEntity(db.expenses, expenses, 'expense');
  db.trashItems = mergeEntity(db.trashItems, trashItems, 'trashItem');

  // Apply pending create/update commands from the durable outbox as well as the
  // full snapshots. This protects an edit made during an earlier in-flight push
  // even if a subsequent pull replaced its local collection object.
  const mutableLists: Record<string, any[]> = {
    product: db.products, sale: db.sales, customer: db.customers,
    debtPayment: db.debtPayments, expense: db.expenses, trashItem: db.trashItems,
  };
  for (const command of outboxQueue) {
    if (!command || !['create', 'update'].includes(command.action) || !command.data) continue;
    if (command.entityType === 'storeInfo') {
      if (typeof command.data === 'object') db.storeInfo = { ...db.storeInfo, ...command.data };
      continue;
    }
    const target = mutableLists[command.entityType];
    const incoming = command.data;
    if (!target || !incoming.id) continue;
    if ((db.deletedEntities || []).some(item => item.entityType === command.entityType && item.id === incoming.id)) continue;
    const index = target.findIndex((item: any) => item.id === incoming.id);
    if (index < 0) target.push(incoming);
    else {
      const existing = target[index];
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
      if (incomingTime >= existingTime) target[index] = incoming;
    }
  }

  // Process explicit deletion commands after merge to prevent stale snapshots
  // from resurrecting a permanently deleted entity or removed trash entry.
  const listByType: Record<string, any[]> = {
    product: db.products, sale: db.sales, customer: db.customers,
    debtPayment: db.debtPayments, expense: db.expenses, trashItem: db.trashItems,
  };
  for (const command of outboxQueue) {
    if (command?.action !== 'delete' || !command?.data?.id) continue;
    const tombstoneType = command.entityType;
    const deletedAt = command.timestamp || new Date().toISOString();
    const tombstonesByKey = new Map((db.deletedEntities || []).map(item => [`${item.entityType}:${item.id}`, item]));
    tombstonesByKey.set(`${tombstoneType}:${command.data.id}`, { entityType: tombstoneType, id: command.data.id, deletedAt });
    db.deletedEntities = Array.from(tombstonesByKey.values());
    const filtered = (listByType[command.entityType] || []).filter((item: any) => item.id !== command.data.id);
    if (command.entityType === 'product') db.products = filtered;
    else if (command.entityType === 'sale') db.sales = filtered;
    else if (command.entityType === 'customer') db.customers = filtered;
    else if (command.entityType === 'debtPayment') db.debtPayments = filtered;
    else if (command.entityType === 'expense') db.expenses = filtered;
    else if (command.entityType === 'trashItem') db.trashItems = filtered;
  }
  if (storeInfo && typeof storeInfo === 'object') db.storeInfo = { ...db.storeInfo, ...storeInfo };

  saveDatabase(db);

  res.json({
    success: true,
    lastUpdated: db.lastUpdated,
    version: db.version,
  });
});

function mergeBackupEntities<T extends { id?: string; updatedAt?: string; createdAt?: string }>(current: T[], backup: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of current) if (item.id) map.set(item.id, item);
  for (const item of backup) {
    if (!item.id) continue;
    const existing = map.get(item.id);
    const currentTime = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime();
    const backupTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
    if (!existing || backupTime >= currentTime) map.set(item.id, item);
  }
  return Array.from(map.values());
}

// 7. Full Backup Export
app.get('/api/backup/export', (req: Request, res: Response) => {
  const db = getDatabase();
  const filename = `superette-elhanaa-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(db, null, 2));
});

// 8. Restore from Backup
app.post('/api/backup/restore', (req: Request, res: Response) => {
  try {
    const backupData = req.body;
    if (!backupData || !Array.isArray(backupData.products) || !Array.isArray(backupData.sales)) {
      res.status(400).json({ success: false, message: 'ملف النسخة الاحتياطية غير صالح أو تالف.' });
      return;
    }
    const currentDb = getDatabase();
    const restoredDb: StoreDatabase = {
      shopKey: currentDb.shopKey, // keep current pairing key so devices don't drop
      storeInfo: currentDb.storeInfo,
      products: mergeBackupEntities(currentDb.products, backupData.products || []),
      sales: mergeBackupEntities(currentDb.sales, backupData.sales || []),
      customers: mergeBackupEntities(currentDb.customers, backupData.customers || []),
      debtPayments: mergeBackupEntities(currentDb.debtPayments, backupData.debtPayments || []),
      expenses: mergeBackupEntities(currentDb.expenses, backupData.expenses || []),
      trashItems: mergeBackupEntities(currentDb.trashItems, backupData.trashItems || []),
      deletedEntities: Array.from(new Map([...(currentDb.deletedEntities || []), ...(Array.isArray(backupData.deletedEntities) ? backupData.deletedEntities : [])].map(item => [`${item.entityType}:${item.id}`, item])).values()),
      lastUpdated: new Date().toISOString(),
      version: (currentDb.version || 0) + 1,
    };
    saveDatabase(restoredDb);
    res.json({
      success: true,
      message: 'تم استرجاع النسخة الاحتياطية بنجاح!',
      counts: {
        products: restoredDb.products.length,
        sales: restoredDb.sales.length,
        customers: restoredDb.customers.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'فشل استرجاع النسخة: ' + err.message });
  }
});

// 9. Reset or Clear Database (with confirmation protection)
app.post('/api/database/clear', (req: Request, res: Response) => {
  const { confirmationText } = req.body;
  if (confirmationText !== 'تأكيد مسح البيانات') {
    res.status(400).json({ success: false, message: 'رمز التأكيد غير مطابق.' });
    return;
  }
  const db = getDatabase();
  db.products = [];
  db.sales = [];
  db.customers = [];
  db.debtPayments = [];
  db.expenses = [];
  db.trashItems = [];
  db.deletedEntities = [];
  saveDatabase(db);
  res.json({ success: true, message: 'تم تصفير قاعدة البيانات بنجاح.' });
});

// Mount Vite or static files
async function startServer() {
  const http = await import('node:http');
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`سوبيرات الهناء Server running on http://0.0.0.0:${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
