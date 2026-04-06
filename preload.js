const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
    // Database operations
    getProducts: () => ipcRenderer.invoke('db-get-products'),
    addProduct: (product) => ipcRenderer.invoke('db-add-product', product),
    updateProduct: (product) => ipcRenderer.invoke('db-update-product', product),
    deleteProduct: (id) => ipcRenderer.invoke('db-delete-product', id),

    getCustomers: () => ipcRenderer.invoke('db-get-customers'),
    addCustomer: (customer) => ipcRenderer.invoke('db-add-customer', customer),
    updateCustomer: (customer) => ipcRenderer.invoke('db-update-customer', customer),
    deleteCustomer: (id) => ipcRenderer.invoke('db-delete-customer', id),

    getSales: () => ipcRenderer.invoke('db-get-sales'),
    addSale: (sale) => ipcRenderer.invoke('db-add-sale', sale),
    addSaleItem: (item) => ipcRenderer.invoke('db-add-sale-item', item),

    updateStock: (productId, quantity) => ipcRenderer.invoke('db-update-stock', productId, quantity),

    getCustomerDebt: (customerId) => ipcRenderer.invoke('db-get-customer-debt', customerId),
    updateCustomerDebt: (customerId, amount) => ipcRenderer.invoke('db-update-customer-debt', customerId, amount),
    addDebtPayment: (payment) => ipcRenderer.invoke('db-add-debt-payment', payment),

    getLowStock: () => ipcRenderer.invoke('db-get-low-stock'),
    getSalesReport: (startDate, endDate) => ipcRenderer.invoke('db-get-sales-report', startDate, endDate),

    // Event listeners
    onShowInventory: (callback) => ipcRenderer.on('show-inventory', callback),
    onShowSalesReport: (callback) => ipcRenderer.on('show-sales-report', callback),

    // License methods
    checkLicense: () => ipcRenderer.invoke('license-check'),
    activateLicense: (key) => ipcRenderer.invoke('license-activate', key),
    deactivateLicense: () => ipcRenderer.invoke('license-deactivate'),

    // License event listeners
    onLicenseStatus: (callback) => ipcRenderer.on('license-status', callback)
});