// Global variables
let products = [];
let customers = [];
let cart = [];
let currentTab = 'pos';

// Printer settings
let printerSettings = {
    paperWidth: 80,
    fontSize: 12,
    printHeader: true,
    margin: 2,
    copies: 1
};

// License management variables
let licenseStatus = null;
let licenseCheckInterval = null;

// Currency formatter
function formatIQD(amount) {
    return Math.round(amount).toLocaleString('ar-IQ') + ' د.ع';
}

// DOM Elements
const tabs = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const productsGrid = document.getElementById('productsGrid');
const cartItems = document.getElementById('cartItems');
const barcodeInput = document.getElementById('barcodeInput');
const customerSelect = document.getElementById('customerSelect');
const clearCartBtn = document.getElementById('clearCartBtn');
const processDebtBtn = document.getElementById('processDebtBtn');
const paidAmountInput = document.getElementById('paidAmount');
const debtPaymentSection = document.getElementById('debtPaymentSection');
const searchProduct = document.getElementById('searchProduct');
const categoryFilter = document.getElementById('categoryFilter');
const addProductBtn = document.getElementById('addProductBtn');
const addCustomerBtn = document.getElementById('addCustomerBtn');
const generateReportBtn = document.getElementById('generateReportBtn');

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {

    // Load printer settings
    await loadPrinterSettings();

    // Add printer button to UI
    addPrinterButton();

    // Setup printer modal buttons
    const savePrinterBtn = document.getElementById('savePrinterSettings');
    if (savePrinterBtn) {
        savePrinterBtn.addEventListener('click', savePrinterSettings);
    }

    const testPrintBtn = document.getElementById('testPrintBtn');
    if (testPrintBtn) {
        testPrintBtn.addEventListener('click', testPrint);
    }

    // First check license
    const isLicensed = await checkLicense();

    if (isLicensed) {
        // Only load app data if licensed

        await loadData();
        setupEventListeners();
        updateDateTime();
        setInterval(updateDateTime, 1000);

        // Listen for menu events
        if (window.api) {
            window.api.onShowInventory(() => {
                switchTab('inventory');
            });

            window.api.onShowSalesReport(() => {
                switchTab('reports');
                generateReport();
            });
        }
    }

    // Setup license modal buttons
    const activateBtn = document.getElementById('activateLicenseBtn');
    if (activateBtn) {
        activateBtn.addEventListener('click', activateLicense);
    }

    const deactivateBtn = document.getElementById('deactivateLicenseBtn');
    if (deactivateBtn) {
        deactivateBtn.addEventListener('click', deactivateLicense);
    }

    // Close modal handler
    const modalClose = document.querySelector('#licenseModal .close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            if (licenseStatus?.status !== 'active') {
                showNotification('يجب تفعيل الترخيص لاستخدام البرنامج', 'error');
                return;
            }
            document.getElementById('licenseModal').style.display = 'none';
        });
    }

    // Enter key in license input
    const licenseKeyInput = document.getElementById('licenseKey');
    if (licenseKeyInput) {
        licenseKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') activateLicense();
        });
    }

    // Listen for license status from main process
    if (window.api) {
        window.api.onLicenseStatus((event, status) => {
            licenseStatus = status;
            if (status.status === 'active' && status.daysRemaining <= 7) {
                showLicenseWarning(`تبقى ${status.daysRemaining} يوم على انتهاء الترخيص`);
            }
        });
    }

    // Check license periodically (every hour)
    setInterval(async () => {
        const status = await window.api.checkLicense();
        if (status.status !== 'active') {
            showLicenseRequired();
            enableAppFeatures(false);
        } else if (status.daysRemaining <= 3) {
            showLicenseWarning(`⚠️ تحذير: تبقى ${status.daysRemaining} يوم فقط على انتهاء الترخيص!`);
        }
    }, 60 * 60 * 1000); // Check every hour


});

// Load data from database
async function loadData() {
    try {
        products = await window.api.getProducts();
        customers = await window.api.getCustomers();
        renderProducts();
        renderProductsTable(); // Ensure this is called
        renderCustomers();
        renderCustomerSelect();
        updateLowStockWarning();
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('خطأ في تحميل البيانات', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Barcode input
    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBarcodeScan(barcodeInput.value);
        }
    });

    // Clear cart
    clearCartBtn.addEventListener('click', clearCart);

    // Payment methods
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const method = btn.getAttribute('data-method');
            handlePayment(method);
        });
    });

    // Process debt payment
    processDebtBtn?.addEventListener('click', () => {
        const paidAmount = parseFloat(paidAmountInput.value);
        if (isNaN(paidAmount) || paidAmount < 0) {
            showNotification('الرجاء إدخال مبلغ صحيح', 'error');
            return;
        }
        processDebtPayment(paidAmount);
    });

    // Inventory search and filter
    searchProduct?.addEventListener('input', filterProducts);
    categoryFilter?.addEventListener('change', filterProducts);

    // Add product
    addProductBtn?.addEventListener('click', () => openProductModal());

    // Add customer
    addCustomerBtn?.addEventListener('click', () => openCustomerModal());

    // Generate report
    generateReportBtn?.addEventListener('click', generateReport);

    // Modals close
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').style.display = 'none';
        });
    });

    // Product form submit
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', saveProduct);
    }

    // Customer form submit
    const customerForm = document.getElementById('customerForm');
    if (customerForm) {
        customerForm.addEventListener('submit', saveCustomer);
    }

    // Debt payment form submit
    const debtPaymentForm = document.getElementById('debtPaymentForm');
    if (debtPaymentForm) {
        debtPaymentForm.addEventListener('submit', saveDebtPayment);
    }
}

// Switch tabs
function switchTab(tabId) {
    currentTab = tabId;

    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === `${tabId}-tab`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Refresh data when switching tabs
    if (tabId === 'pos') {
        barcodeInput.focus();
    } else if (tabId === 'inventory') {
        renderProductsTable();
    } else if (tabId === 'customers') {
        renderCustomers();
    } else if (tabId === 'debts') {
        renderDebtsList();
    }
}

// Handle barcode scan
async function handleBarcodeScan(barcode) {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
        addToCart(product);
        barcodeInput.value = '';
        showNotification(`تم إضافة ${product.name_ar} إلى السلة`, 'success');
    } else {
        showNotification('المنتج غير موجود', 'error');
    }
}

// Add to cart
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        if (existingItem.quantity < product.stock) {
            existingItem.quantity++;
        } else {
            showNotification('الكمية المتوفرة غير كافية', 'error');
            return;
        }
    } else {
        if (product.stock > 0) {
            cart.push({ ...product, quantity: 1 });
        } else {
            showNotification('المنتج غير متوفر في المخزون', 'error');
            return;
        }
    }
    renderCart();
}

// Update cart quantity
function updateCartQuantity(productId, delta) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        const newQuantity = item.quantity + delta;
        if (newQuantity > 0 && newQuantity <= item.stock) {
            item.quantity = newQuantity;
        } else if (newQuantity <= 0) {
            cart = cart.filter(item => item.id !== productId);
        } else {
            showNotification('الكمية المتوفرة غير كافية', 'error');
        }
        renderCart();
    }
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}

// Clear cart
function clearCart() {
    if (cart.length > 0 && confirm('هل أنت متأكد من تفريغ السلة؟')) {
        cart = [];
        renderCart();
        showNotification('تم تفريغ السلة', 'success');
    }
    barcodeInput.focus();
}

// Render cart
function renderCart() {
    if (!cartItems) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal; // No tax

    document.getElementById('cartTotal').textContent = formatIQD(subtotal);
    document.getElementById('cartTax').textContent = '0 د.ع';
    document.getElementById('cartGrandTotal').textContent = formatIQD(total);

    // Hide tax row if it exists
    const taxRow = document.querySelector('.summary-row.tax-row');
    if (taxRow) {
        taxRow.style.display = 'none';
    }

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart">السلة فارغة</div>';
        return;
    }

    cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name_ar}</div>
        <div class="cart-item-price">${formatIQD(item.price)}</div>
      </div>
      <div class="cart-item-controls">
        <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, -1)">-</button>
        <span class="cart-item-quantity">${item.quantity}</span>
        <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, 1)">+</button>
        <span class="cart-item-total">${formatIQD(item.price * item.quantity)}</span>
        <button class="remove-item" onclick="removeFromCart(${item.id})">×</button>
      </div>
    </div>
  `).join('');
}

// Handle payment
async function handlePayment(method) {
    if (cart.length === 0) {
        showNotification('السلة فارغة', 'error');
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal; // No tax

    const customerId = customerSelect.value;
    let paid = total;
    let debtAmount = 0;

    if (method === 'debt') {
        if (!customerId) {
            showNotification('الرجاء اختيار عميل للدين', 'error');
            return;
        }
        debtPaymentSection.style.display = 'block';
        return;
    }

    if (method === 'cash') {
            paid = Math.round(parseFloat(total));
    }

    await processSale(method, customerId, total, paid, debtAmount);
}

// Process debt payment - FIXED (removed tax)
async function processDebtPayment(paidAmount) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0); // No tax - FIXED

    const customerId = customerSelect.value;
    const debtAmount = total - paidAmount;

    if (debtAmount < 0) {
        showNotification('المبلغ المدفوع أكبر من الإجمالي', 'error');
        return;
    }

    await processSale('debt', customerId, total, paidAmount, debtAmount);
    debtPaymentSection.style.display = 'none';
    paidAmountInput.value = '';
}

// Process sale
async function processSale(method, customerId, total, paid, debtAmount) {
    try {
        // Round all amounts to integers (no decimals)
        total = Math.round(total);
        paid = Math.round(paid);
        debtAmount = Math.round(debtAmount);

        // Create sale record
        const sale = {
            customer_id: customerId || null,
            total: total,
            paid: paid,
            debt_amount: debtAmount,
            payment_method: method
        };

        const saleResult = await window.api.addSale(sale);
        const saleId = saleResult.id;

        // Add sale items and update stock
        for (const item of cart) {
            await window.api.addSaleItem({
                sale_id: saleId,
                product_id: item.id,
                quantity: item.quantity,
                price: Math.round(item.price),
                total: Math.round(item.price * item.quantity)
            });

            await window.api.updateStock(item.id, item.quantity);
        }

        // Update customer debt if any
        if (customerId && debtAmount > 0) {
            await window.api.updateCustomerDebt(customerId, debtAmount);
        }

        // Print receipt
        printReceipt(saleId, method, customerId, total, paid, debtAmount);

        // Clear cart and reload data
        cart = [];
        renderCart();
        await loadData();

        showNotification('تمت العملية بنجاح', 'success');
    } catch (error) {
        console.error('Error processing sale:', error);
        showNotification('حدث خطأ في معالجة العملية', 'error');
    }
}

// Print receipt
// Complete printReceipt function with full content
function printReceipt(saleId, method, customerId, total, paid, debtAmount) {
    const customer = customers.find(c => c.id == customerId);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create print window
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');

    // Generate items HTML
    const itemsHtml = cart.map(item => `
        <div class="item">
            <span class="item-name">${item.name_ar}</span>
            <span class="item-qty">${item.quantity}</span>
            <span class="item-price">${Math.round(item.price).toLocaleString('ar-IQ')}</span>
            <span class="item-total">${Math.round(item.price * item.quantity).toLocaleString('ar-IQ')}</span>
        </div>
    `).join('');

    const receiptHtml = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>فاتورة البيع</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Cairo', 'Courier New', monospace;
                font-size: 12px;
                width: 80mm;
                margin: 0 auto;
                padding: 2mm;
                direction: rtl;
                background: white;
            }
            
            .receipt {
                width: 100%;
                max-width: 80mm;
                margin: 0 auto;
                background: white;
            }
            
            .header {
                text-align: center;
                border-bottom: 1px dashed #000;
                margin-bottom: 8px;
                padding-bottom: 8px;
            }
            
            .store-name {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .store-info {
                font-size: 10px;
                margin: 2px 0;
            }
            
            .invoice-details {
                margin: 8px 0;
                padding: 5px 0;
                border-bottom: 1px dotted #000;
                font-size: 10px;
            }
            
            .invoice-details div {
                margin: 2px 0;
            }
            
            .items {
                width: 100%;
                margin: 8px 0;
            }
            
            .item-header {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px dotted #000;
                padding-bottom: 5px;
                margin-bottom: 5px;
                font-weight: bold;
                font-size: 11px;
            }
            
            .item {
                display: flex;
                justify-content: space-between;
                margin: 3px 0;
                padding: 2px 0;
                font-size: 11px;
            }
            
            .item-name {
                flex: 2;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-left: 5px;
            }
            
            .item-qty {
                flex: 0.5;
                text-align: center;
            }
            
            .item-price {
                flex: 1;
                text-align: left;
                padding-left: 5px;
            }
            
            .item-total {
                flex: 1;
                text-align: left;
                font-weight: bold;
            }
            
            .divider {
                border-top: 1px dashed #000;
                margin: 8px 0;
            }
            
            .total-row {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
                padding: 3px 0;
                font-size: 12px;
            }
            
            .total-grand {
                font-size: 14px;
                font-weight: bold;
                border-top: 1px solid #000;
                margin-top: 5px;
                padding-top: 8px;
            }
            
            .payment-info {
                margin: 8px 0;
                padding: 8px 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
            }
            
            .payment-info div {
                margin: 3px 0;
            }
            
            .footer {
                text-align: center;
                margin-top: 10px;
                padding-top: 8px;
                border-top: 1px dashed #000;
                font-size: 10px;
            }
            
            .thankyou {
                font-size: 12px;
                font-weight: bold;
                margin: 5px 0;
            }
            
            @media print {
                body {
                    width: 80mm;
                    margin: 0;
                    padding: 1mm;
                }
                
                .receipt {
                    width: 100%;
                }
                
                @page {
                    size: 80mm auto;
                    margin: 0mm;
                }
            }
        </style>
    </head>
    <body>
        <div class="receipt">
            <div class="header">
                <div class="store-name">مكتبة الريم</div>
                <div class="store-info">هاتف: 07819202703</div>
                <div class="store-info">العنوان: ناحية الزاب - السايدين</div>
            </div>
            
            <div class="invoice-details">
                <div> فاتورة رقم: ${saleId}</div>
                <div>التاريخ: ${new Date().toLocaleString('ar-IQ')}</div>
                ${customer ? `<div> العميل: ${customer.name}</div>` : ''}
                ${customer && customer.phone ? `<div>📱 الهاتف: ${customer.phone}</div>` : ''}
                <div> طريقة الدفع: ${method === 'cash' ? 'نقدي' : method === 'card' ? 'بطاقة' : 'دين'}</div>
            </div>
            
            <div class="items">
                <div class="item-header">
                    <span class="item-name">المنتج</span>
                    <span class="item-qty">كمية</span>
                    <span class="item-price">السعر</span>
                    <span class="item-total">الإجمالي</span>
                </div>
                ${itemsHtml}
            </div>
            
            <div class="divider"></div>
            
            <div class="total-row">
                <span>المجموع الفرعي:</span>
                <span>${Math.round(subtotal).toLocaleString('ar-IQ')} د.ع</span>
            </div>
            
            <div class="total-row">
                <span>الضريبة (0%):</span>
                <span>0 د.ع</span>
            </div>
            
            <div class="total-row total-grand">
                <span>الإجمالي:</span>
                <span>${Math.round(total).toLocaleString('ar-IQ')} د.ع</span>
            </div>
            
            <div class="payment-info">
                <div> المدفوع: ${Math.round(paid).toLocaleString('ar-IQ')} د.ع</div>
                ${debtAmount > 0 ? `
                    <div style="color: red;"> المتبقي (دين): ${Math.round(debtAmount).toLocaleString('ar-IQ')} د.ع</div>
                ` : ''}
                ${method === 'cash' && paid > total ? `
                    <div>🔄 الباقي: ${Math.round(paid - total).toLocaleString('ar-IQ')} د.ع</div>
                ` : ''}
            </div>
            
            <div class="footer">
                <div class="thankyou">شكراً لزيارتكم</div>
                <div style="margin-top:8px; font-size:11px; color:#555;">البسيط لإدارة المبيعات - للاستفسار: 07827626713</div>
            </div>
        </div>
        
        <script>
            // Auto-print when loaded
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                }, 500);
            };
        </script>
    </body>
    </html>
    `;

    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
}
function renderProducts() {
    if (!productsGrid) return;

    const searchTerm = barcodeInput.value.toLowerCase();
    const filteredProducts = products.filter(p =>
        p.name_ar.includes(searchTerm) ||
        (p.barcode && p.barcode.includes(searchTerm))
    );

    productsGrid.innerHTML = filteredProducts.map(product => `
    <div class="product-card" onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')})">
      <div class="product-name">${product.name_ar}</div>
      <div class="product-price">${Math.round(product.price).toLocaleString('ar-IQ')} د.ع</div>
      <div class="product-stock">المتبقي: ${product.stock}</div>
    </div>
  `).join('');
}

// Render products table (inventory)
function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const searchTerm = searchProduct?.value.toLowerCase() || '';
    const category = categoryFilter?.value || '';

    const filteredProducts = products.filter(p => {
        const matchSearch = p.name_ar.includes(searchTerm) ||
            (p.barcode && p.barcode.includes(searchTerm));
        const matchCategory = !category || p.category === category;
        return matchSearch && matchCategory;
    });

    tbody.innerHTML = filteredProducts.map(product => `
    <tr>
      <td>${product.barcode || '-'}</td>
      <td>${product.name_ar}</td>
      <td>${Math.round(product.price).toLocaleString('ar-IQ')} د.ع</td>
      <td class="${product.stock < 10 ? 'low-stock' : ''}">${product.stock}</td>
      <td>${product.category || '-'}</td>
      <td>
        <button class="btn-secondary" onclick="editProduct(${product.id})">تعديل</button>
        <button class="btn-danger-small" onclick="deleteProduct(${product.id})">حذف</button>
      </td>
     </tr>
  `).join('');
}

// Render customers - FIXED (use IQD)
function renderCustomers() {
    const grid = document.getElementById('customersGrid');
    if (!grid) return;

    grid.innerHTML = customers.map(customer => `
    <div class="customer-card">
      <div class="customer-name">${customer.name}</div>
      <div class="customer-phone">📱 ${customer.phone || 'غير متوفر'}</div>
      <div class="customer-address">📍 ${customer.address || 'غير متوفر'}</div>
      <div class="customer-debt">
        ${customer.debt > 0 ? `
          <span class="debt-badge">الدين: ${formatIQD(customer.debt)}</span>
        ` : 'لا يوجد ديون'}
      </div>
      <div class="customer-actions">
        <button class="btn-secondary" onclick="editCustomer(${customer.id})">تعديل</button>
        <button class="btn-danger-small" onclick="deleteCustomer(${customer.id})">حذف</button>
        ${customer.debt > 0 ? `
          <button class="btn-primary" onclick="payDebt(${customer.id})">تسديد دين</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Render customer select dropdown - FIXED (use IQD)
function renderCustomerSelect() {
    if (!customerSelect) return;

    customerSelect.innerHTML = '<option value="">عميل نقدي</option>' +
        customers.map(customer => `
      <option value="${customer.id}">${customer.name} ${customer.debt > 0 ? `(دين: ${formatIQD(customer.debt)})` : ''}</option>
    `).join('');
}

// Render debts list - FIXED (use IQD)
async function renderDebtsList() {
    const container = document.getElementById('debtsList');
    if (!container) return;

    const debtors = customers.filter(c => c.debt > 0);

    if (debtors.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد ديون مستحقة</div>';
        return;
    }

    container.innerHTML = debtors.map(customer => `
    <div class="debt-card">
      <div class="debt-info">
        <h4>${customer.name}</h4>
        <p>📱 ${customer.phone || 'رقم غير متوفر'}</p>
      </div>
      <div class="debt-amount">
        ${formatIQD(customer.debt)}
      </div>
      <div class="debt-actions">
        <button class="btn-primary" onclick="payDebt(${customer.id})">تسديد</button>
      </div>
    </div>
  `).join('');
}

// Generate sales report
async function generateReport() {
    const startDate = document.getElementById('reportStartDate')?.value;
    const endDate = document.getElementById('reportEndDate')?.value;

    if (!startDate || !endDate) {
        showNotification('الرجاء تحديد فترة التقرير', 'error');
        return;
    }

    try {
        const sales = await window.api.getSalesReport(startDate, endDate);
        renderReport(sales);
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('خطأ في إنشاء التقرير', 'error');
    }
}

// Render report - FIXED (use IQD)
function renderReport(sales) {
    const tbody = document.getElementById('reportTableBody');
    const summary = document.getElementById('reportSummary');

    if (!tbody || !summary) return;

    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalPaid = sales.reduce((sum, sale) => sum + (sale.paid || 0), 0);
    const totalDebt = sales.reduce((sum, sale) => sum + (sale.debt_amount || 0), 0);

    summary.innerHTML = `
    <div class="report-summary-cards">
      <div class="summary-card">
        <h4>إجمالي المبيعات</h4>
        <p>${formatIQD(totalSales)}</p>
      </div>
      <div class="summary-card">
        <h4>إجمالي المدفوعات</h4>
        <p>${formatIQD(totalPaid)}</p>
      </div>
      <div class="summary-card">
        <h4>إجمالي الديون</h4>
        <p>${formatIQD(totalDebt)}</p>
      </div>
      <div class="summary-card">
        <h4>عدد الفواتير</h4>
        <p>${sales.length}</p>
      </div>
    </div>
  `;

    tbody.innerHTML = sales.map(sale => `
    <tr>
      <td>${sale.id}</td>
      <td>${new Date(sale.sale_date).toLocaleDateString('ar-IQ')}</td>
      <td>${sale.customer_name || 'نقدي'}</td>
      <td>${formatIQD(sale.total)}</td>
      <td>${formatIQD(sale.paid || 0)}</td>
      <td class="${(sale.debt_amount || 0) > 0 ? 'debt-amount' : ''}">${formatIQD(sale.debt_amount || 0)}</td>
      <td>${sale.payment_method === 'cash' ? 'نقدي' : sale.payment_method === 'card' ? 'بطاقة' : 'دين'}</td>
     </tr>
  `).join('');
}

// Filter products in inventory
function filterProducts() {
    renderProductsTable();
}

// Open product modal
function openProductModal(product = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    if (product) {
        title.textContent = 'تعديل منتج';
        document.getElementById('productId').value = product.id;
        document.getElementById('productNameAr').value = product.name_ar;
        // Check if English name field exists
        const nameEnField = document.getElementById('productNameEn');
        if (nameEnField) nameEnField.value = product.name || '';
        document.getElementById('productBarcode').value = product.barcode || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCost').value = product.cost || '';
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productCategory').value = product.category || '';
    } else {
        title.textContent = 'إضافة منتج جديد';
        form.reset();
        document.getElementById('productId').value = '';
    }

    modal.style.display = 'block';
}

// Save product
async function saveProduct(e) {
    e.preventDefault();

    const product = {
        id: document.getElementById('productId').value,
        name: document.getElementById('productNameEn')?.value || document.getElementById('productNameAr').value, // Fallback to Arabic if English field missing
        name_ar: document.getElementById('productNameAr').value,
        barcode: document.getElementById('productBarcode').value || null,
        price: parseFloat(document.getElementById('productPrice').value),
        cost: parseFloat(document.getElementById('productCost').value) || 0,
        stock: parseInt(document.getElementById('productStock').value),
        category: document.getElementById('productCategory').value
    };

    // Validate required fields
    if (!product.name_ar) {
        showNotification('الرجاء إدخال الاسم (عربي)', 'error');
        return;
    }

    if (isNaN(product.price) || product.price <= 0) {
        showNotification('الرجاء إدخال سعر صحيح', 'error');
        return;
    }

    if (isNaN(product.stock) || product.stock < 0) {
        showNotification('الرجاء إدخال كمية مخزون صحيحة', 'error');
        return;
    }

    try {
        if (product.id) {
            await window.api.updateProduct(product);
            showNotification('تم تحديث المنتج بنجاح', 'success');
        } else {
            await window.api.addProduct(product);
            showNotification('تم إضافة المنتج بنجاح', 'success');
        }

        await loadData();
        renderProductsTable();
        document.getElementById('productModal').style.display = 'none';
    } catch (error) {
        console.error('Error saving product:', error);
        showNotification('حدث خطأ في حفظ المنتج: ' + error.message, 'error');
    }
}

// Edit product
window.editProduct = async (id) => {
    const product = products.find(p => p.id === id);
    if (product) {
        openProductModal(product);
    }
};

// Delete product
window.deleteProduct = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        try {
            await window.api.deleteProduct(id);
            await loadData();
            renderProductsTable();
            showNotification('تم حذف المنتج بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting product:', error);
            showNotification('حدث خطأ في حذف المنتج', 'error');
        }
    }
};

// Open customer modal
function openCustomerModal(customer = null) {
    const modal = document.getElementById('customerModal');
    const title = document.getElementById('customerModalTitle');
    const form = document.getElementById('customerForm');

    if (customer) {
        title.textContent = 'تعديل عميل';
        document.getElementById('customerId').value = customer.id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerPhone').value = customer.phone || '';
        document.getElementById('customerAddress').value = customer.address || '';
    } else {
        title.textContent = 'إضافة عميل جديد';
        form.reset();
    }

    modal.style.display = 'block';
}

// Save customer
async function saveCustomer(e) {
    e.preventDefault();

    const customer = {
        id: document.getElementById('customerId').value,
        name: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        address: document.getElementById('customerAddress').value,
        debt: 0
    };

    try {
        if (customer.id) {
            const existingCustomer = customers.find(c => c.id == customer.id);
            customer.debt = existingCustomer.debt;
            await window.api.updateCustomer(customer);
            showNotification('تم تحديث العميل بنجاح', 'success');
        } else {
            await window.api.addCustomer(customer);
            showNotification('تم إضافة العميل بنجاح', 'success');
        }

        await loadData();
        renderCustomers();
        renderCustomerSelect();
        document.getElementById('customerModal').style.display = 'none';
    } catch (error) {
        console.error('Error saving customer:', error);
        showNotification('حدث خطأ في حفظ العميل', 'error');
    }
}

// Edit customer
window.editCustomer = async (id) => {
    const customer = customers.find(c => c.id === id);
    if (customer) {
        openCustomerModal(customer);
    }
};

// Delete customer
window.deleteCustomer = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا العميل؟')) {
        try {
            await window.api.deleteCustomer(id);
            await loadData();
            renderCustomers();
            renderCustomerSelect();
            showNotification('تم حذف العميل بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting customer:', error);
            showNotification('حدث خطأ في حذف العميل', 'error');
        }
    }
};

// Pay debt
window.payDebt = (customerId) => {
    const modal = document.getElementById('debtPaymentModal');
    document.getElementById('debtCustomerId').value = customerId;
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentNotes').value = '';
    modal.style.display = 'block';
};

// Save debt payment
async function saveDebtPayment(e) {
    e.preventDefault();

    const customerId = document.getElementById('debtCustomerId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const notes = document.getElementById('paymentNotes').value;

    if (isNaN(amount) || amount <= 0) {
        showNotification('الرجاء إدخال مبلغ صحيح', 'error');
        return;
    }

    const customer = customers.find(c => c.id == customerId);
    if (amount > customer.debt) {
        showNotification('المبلغ أكبر من قيمة الدين', 'error');
        return;
    }

    try {
        await window.api.addDebtPayment({
            customer_id: customerId,
            amount: amount,
            notes: notes
        });

        await loadData();
        renderCustomers();
        renderDebtsList();
        renderCustomerSelect();

        document.getElementById('debtPaymentModal').style.display = 'none';
        showNotification('تم تسجيل الدفع بنجاح', 'success');
    } catch (error) {
        console.error('Error saving debt payment:', error);
        showNotification('حدث خطأ في تسجيل الدفع', 'error');
    }
}

// Update low stock warning
async function updateLowStockWarning() {
    try {
        const lowStockProducts = await window.api.getLowStock();
        if (lowStockProducts && lowStockProducts.length > 0) {
            showNotification(`تنبيه: ${lowStockProducts.length} منتج بمخزون منخفض`, 'info');
        }
    } catch (error) {
        console.error('Error checking low stock:', error);
    }
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = now.toLocaleDateString('ar-IQ', options);
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

async function checkLicense() {
    try {
        const status = await window.api.checkLicense();
        licenseStatus = status;

        if (status.status === 'active') {
            if (status.daysRemaining <= 7) {
                showLicenseWarning(`⚠️ تنبيه: تبقى ${status.daysRemaining} يوم على انتهاء الترخيص`);
            }
            enableAppFeatures(true);
            return true;
        } else {
            showLicenseRequired();
            enableAppFeatures(false);
            return false;
        }
    } catch (error) {
        console.error('Error checking license:', error);
        showLicenseError('حدث خطأ في التحقق من الترخيص');
        enableAppFeatures(false);
        return false;
    }
}

// Show license required modal
function showLicenseRequired() {
    const modal = document.getElementById('licenseModal');
    const statusDiv = document.getElementById('licenseStatusMessage');
    const activationForm = document.getElementById('licenseActivationForm');
    const licenseInfo = document.getElementById('licenseInfo');

    statusDiv.innerHTML = '❌ البرنامج غير مرخص. الرجاء إدخال مفتاح التفعيل.';
    statusDiv.className = 'license-status-inactive';
    activationForm.style.display = 'block';
    licenseInfo.style.display = 'none';

    modal.style.display = 'block';
}

// Show license error
function showLicenseError(message) {
    const modal = document.getElementById('licenseModal');
    const statusDiv = document.getElementById('licenseStatusMessage');

    statusDiv.innerHTML = `❌ ${message}`;
    statusDiv.className = 'license-status-inactive';
    modal.style.display = 'block';
}

// Show license warning banner
function showLicenseWarning(message) {
    const banner = document.createElement('div');
    banner.className = 'license-warning-banner';
    banner.innerHTML = message;
    banner.onclick = () => showLicenseInfo();
    document.body.insertBefore(banner, document.body.firstChild);

    setTimeout(() => {
        if (banner.parentNode) banner.remove();
    }, 10000);
}

// Show license info
async function showLicenseInfo() {
    const status = await window.api.checkLicense();
    const modal = document.getElementById('licenseModal');
    const statusDiv = document.getElementById('licenseStatusMessage');
    const activationForm = document.getElementById('licenseActivationForm');
    const licenseInfo = document.getElementById('licenseInfo');

    if (status.status === 'active') {
        statusDiv.innerHTML = '✅ الترخيص نشط';
        statusDiv.className = 'license-status-active';
        activationForm.style.display = 'none';
        licenseInfo.style.display = 'block';

        document.getElementById('licenseStatusText').textContent = 'نشط';
        document.getElementById('licenseCustomer').textContent = status.customerName || 'غير محدد';
        document.getElementById('licenseExpiry').textContent = new Date(status.expiresAt).toLocaleDateString('ar-IQ');
        document.getElementById('licenseDaysRemaining').textContent = status.daysRemaining;
    } else {
        statusDiv.innerHTML = `❌ ${status.reason}`;
        statusDiv.className = 'license-status-inactive';
        activationForm.style.display = 'block';
        licenseInfo.style.display = 'none';
    }

    modal.style.display = 'block';
}

// Activate license
async function activateLicense() {
    const licenseKey = document.getElementById('licenseKey').value.trim();

    if (!licenseKey) {
        showNotification('الرجاء إدخال مفتاح الترخيص', 'error');
        return;
    }

    const activateBtn = document.getElementById('activateLicenseBtn');
    activateBtn.disabled = true;
    activateBtn.textContent = 'جاري التفعيل...';

    try {
        const result = await window.api.activateLicense(licenseKey);

        if (result.success) {
            showNotification(result.message, 'success');
            document.getElementById('licenseModal').style.display = 'none';
            await checkLicense(); // Re-check license status
            location.reload(); // Reload to apply changes
        } else {
            showNotification(result.message, 'error');
            activateBtn.disabled = false;
            activateBtn.textContent = 'تفعيل';
        }
    } catch (error) {
        console.error('Error activating license:', error);
        showNotification('حدث خطأ في تفعيل الترخيص', 'error');
        activateBtn.disabled = false;
        activateBtn.textContent = 'تفعيل';
    }
}

// Deactivate license
async function deactivateLicense() {
    if (confirm('هل أنت متأكد من إلغاء تفعيل الترخيص؟')) {
        try {
            const result = await window.api.deactivateLicense();
            if (result.success) {
                showNotification('تم إلغاء تفعيل الترخيص', 'success');
                location.reload();
            } else {
                showNotification('فشل في إلغاء تفعيل الترخيص', 'error');
            }
        } catch (error) {
            console.error('Error deactivating license:', error);
            showNotification('حدث خطأ', 'error');
        }
    }
}

// Enable/disable app features based on license
function enableAppFeatures(enable) {
    const features = [
        'addProductBtn',
        'addCustomerBtn',
        'clearCartBtn',
        'processDebtBtn',
        'generateReportBtn'
    ];

    features.forEach(featureId => {
        const element = document.getElementById(featureId);
        if (element) {
            element.disabled = !enable;
            element.style.opacity = enable ? '1' : '0.5';
            element.style.cursor = enable ? 'pointer' : 'not-allowed';
        }
    });

    // Disable payment buttons
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.disabled = !enable;
        btn.style.opacity = enable ? '1' : '0.5';
        btn.style.cursor = enable ? 'pointer' : 'not-allowed';
    });

    // Disable product clicks in POS
    const productsGrid = document.getElementById('productsGrid');
    if (productsGrid) {
        productsGrid.style.pointerEvents = enable ? 'auto' : 'none';
        productsGrid.style.opacity = enable ? '1' : '0.5';
    }
}

// Load printer settings from storage
async function loadPrinterSettings() {
    try {
        const saved = localStorage.getItem('printerSettings');
        if (saved) {
            printerSettings = JSON.parse(saved);
            applyPrinterSettings();
        }
    } catch (error) {
        console.error('Error loading printer settings:', error);
    }
}

// Save printer settings
async function savePrinterSettings() {
    printerSettings = {
        paperWidth: parseInt(document.getElementById('paperWidth').value),
        fontSize: parseInt(document.getElementById('fontSize').value),
        printHeader: document.getElementById('printHeader').value === 'yes',
        margin: parseInt(document.getElementById('printMargin').value),
        copies: parseInt(document.getElementById('printCopies').value)
    };

    localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
    showNotification('تم حفظ إعدادات الطابعة', 'success');
    document.getElementById('printerModal').style.display = 'none';
}

// Apply printer settings to print preview
function applyPrinterSettings() {
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            body {
                width: ${printerSettings.paperWidth}mm !important;
                font-size: ${printerSettings.fontSize}px !important;
                margin: ${printerSettings.margin}mm !important;
            }
            .receipt {
                width: ${printerSettings.paperWidth}mm !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// Test print
async function testPrint() {
    const testData = {
        saleId: 'TEST',
        method: 'cash',
        customerId: null,
        total: 15000,
        paid: 15000,
        debtAmount: 0
    };

    const testCart = [
        { name_ar: 'منتج تجريبي', price: 15000, quantity: 1 }
    ];

    // Create temporary cart for test
    const originalCart = [...cart];
    cart.push(...testCart);
    printReceipt(testData.saleId, testData.method, testData.customerId, testData.total, testData.paid, testData.debtAmount);
    cart = originalCart;
}

// Add printer button to UI
function addPrinterButton() {
    const paymentSection = document.querySelector('.payment-section');
    if (paymentSection) {
        const printerBtn = document.createElement('button');
        printerBtn.className = 'btn-secondary';
        printerBtn.style.marginTop = '10px';
        printerBtn.style.width = '100%';
        printerBtn.innerHTML = '🖨️ إعدادات الطابعة';
        printerBtn.onclick = () => {
            document.getElementById('printerModal').style.display = 'block';
        };
        paymentSection.appendChild(printerBtn);
    }
}

// Make functions available globally
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.payDebt = payDebt;
window.showLicenseInfo = showLicenseInfo;
