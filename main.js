const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('./database');
const LicenseManager = require('./license');

let mainWindow;
let db;
let licenseManager;

// Handle creating/removing shortcuts on Windows when installing/uninstalling
// Only if electron-squirrel-startup is installed
try {
    if (require('electron-squirrel-startup')) {
        app.quit();
    }
} catch (e) {
    // electron-squirrel-startup not installed, ignore
    console.log('electron-squirrel-startup not available');
}

const createWindow = () => {
    // Check if icon exists
    const iconPath = path.join(__dirname, 'assets/icons/icon.ico');
    const icon = fs.existsSync(iconPath) ? iconPath : undefined;
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: icon,
        title: 'نظام البيع للمكتبات',
        backgroundColor: '#f5f5f5'
    });

    // Load the index.html of the app
    mainWindow.loadFile('index.html');

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Create application menu
    const menuTemplate = [
        {
            label: 'الملف',
            submenu: [
                {
                    label: 'جرد المخزون',
                    click: () => {
                        mainWindow.webContents.send('show-inventory');
                    }
                },
                {
                    label: 'تقرير المبيعات',
                    click: () => {
                        mainWindow.webContents.send('show-sales-report');
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'خروج',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'تعديل',
            submenu: [
                { label: 'تراجع', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'إعادة', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
                { type: 'separator' },
                { label: 'قص', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'نسخ', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'لصق', accelerator: 'CmdOrCtrl+V', role: 'paste' }
            ]
        },
        {
            label: 'عرض',
            submenu: [
                { label: 'إعادة تحميل', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                { label: 'تكبير', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
                { label: 'تصغير', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { type: 'separator' },
                { label: 'ملء الشاشة', accelerator: 'F11', role: 'togglefullscreen' }
            ]
        },
        {
            label: 'مساعدة',
            submenu: [
                {
                    label: 'عن البرنامج',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'عن البرنامج',
                            message: 'نظام نقاط البيع للمكتبات\nالإصدار 1.0.0',
                            detail: 'تم تطويره بواسطة فريق التقنية\nجميع الحقوق محفوظة'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

// IPC Handlers with error handling
ipcMain.handle('db-get-products', async () => {
    try {
        return await db.getProducts();
    } catch (error) {
        console.error('Error in db-get-products:', error);
        throw error;
    }
});

ipcMain.handle('db-add-product', async (event, product) => {
    try {
        return await db.addProduct(product);
    } catch (error) {
        console.error('Error in db-add-product:', error);
        throw error;
    }
});

ipcMain.handle('db-update-product', async (event, product) => {
    try {
        return await db.updateProduct(product);
    } catch (error) {
        console.error('Error in db-update-product:', error);
        throw error;
    }
});

ipcMain.handle('db-delete-product', async (event, id) => {
    try {
        return await db.deleteProduct(id);
    } catch (error) {
        console.error('Error in db-delete-product:', error);
        throw error;
    }
});

ipcMain.handle('db-get-customers', async () => {
    try {
        return await db.getCustomers();
    } catch (error) {
        console.error('Error in db-get-customers:', error);
        throw error;
    }
});

ipcMain.handle('db-add-customer', async (event, customer) => {
    try {
        return await db.addCustomer(customer);
    } catch (error) {
        console.error('Error in db-add-customer:', error);
        throw error;
    }
});

ipcMain.handle('db-update-customer', async (event, customer) => {
    try {
        return await db.updateCustomer(customer);
    } catch (error) {
        console.error('Error in db-update-customer:', error);
        throw error;
    }
});

ipcMain.handle('db-delete-customer', async (event, id) => {
    try {
        return await db.deleteCustomer(id);
    } catch (error) {
        console.error('Error in db-delete-customer:', error);
        throw error;
    }
});

ipcMain.handle('db-get-sales', async () => {
    try {
        return await db.getSales();
    } catch (error) {
        console.error('Error in db-get-sales:', error);
        throw error;
    }
});

ipcMain.handle('db-add-sale', async (event, sale) => {
    try {
        return await db.addSale(sale);
    } catch (error) {
        console.error('Error in db-add-sale:', error);
        throw error;
    }
});

ipcMain.handle('db-add-sale-item', async (event, item) => {
    try {
        return await db.addSaleItem(item);
    } catch (error) {
        console.error('Error in db-add-sale-item:', error);
        throw error;
    }
});

ipcMain.handle('db-update-stock', async (event, productId, quantity) => {
    try {
        return await db.updateStock(productId, quantity);
    } catch (error) {
        console.error('Error in db-update-stock:', error);
        throw error;
    }
});

ipcMain.handle('db-get-customer-debt', async (event, customerId) => {
    try {
        return await db.getCustomerDebt(customerId);
    } catch (error) {
        console.error('Error in db-get-customer-debt:', error);
        throw error;
    }
});

ipcMain.handle('db-update-customer-debt', async (event, customerId, amount) => {
    try {
        return await db.updateCustomerDebt(customerId, amount);
    } catch (error) {
        console.error('Error in db-update-customer-debt:', error);
        throw error;
    }
});

ipcMain.handle('db-add-debt-payment', async (event, payment) => {
    try {
        return await db.addDebtPayment(payment);
    } catch (error) {
        console.error('Error in db-add-debt-payment:', error);
        throw error;
    }
});

ipcMain.handle('db-get-low-stock', async () => {
    try {
        return await db.getLowStockProducts(10);
    } catch (error) {
        console.error('Error in db-get-low-stock:', error);
        throw error;
    }
});

ipcMain.handle('db-get-sales-report', async (event, startDate, endDate) => {
    try {
        return await db.getSalesReport(startDate, endDate);
    } catch (error) {
        console.error('Error in db-get-sales-report:', error);
        throw error;
    }
});

ipcMain.handle('license-check', async () => {
    try {
        const status = licenseManager.getLicenseStatus();
        return status;
    } catch (error) {
        console.error('Error checking license:', error);
        return { status: 'error', reason: 'خطأ في التحقق من الترخيص' };
    }
});

ipcMain.handle('license-activate', async (event, licenseKey) => {
    try {
        const result = licenseManager.activateLicense(licenseKey);
        return result;
    } catch (error) {
        console.error('Error activating license:', error);
        return { success: false, message: 'حدث خطأ في تفعيل الترخيص' };
    }
});

ipcMain.handle('license-deactivate', async () => {
    try {
        const result = licenseManager.deactivateLicense();
        return { success: result };
    } catch (error) {
        console.error('Error deactivating license:', error);
        return { success: false };
    }
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    // Initialize database after app is ready
    try {
        db = new Database();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        dialog.showErrorBox('خطأ في قاعدة البيانات', 'فشل في تهيئة قاعدة البيانات. الرجاء إعادة تشغيل التطبيق.');
        app.quit();
        return;
    }
    licenseManager = new LicenseManager();

    createWindow();

    // Check license on startup and send status to renderer
    const licenseStatus = licenseManager.getLicenseStatus();
    if (mainWindow) {
        mainWindow.webContents.send('license-status', licenseStatus);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Close database connection when app quits
app.on('before-quit', async (event) => {
    if (db && db.db) {
        try {
            await new Promise((resolve, reject) => {
                db.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                        reject(err);
                    } else {
                        console.log('Database closed successfully');
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error('Error closing database:', error);
        }
    }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});