# مكتبة الريم - نظام نقاط البيع
## Project Guide for Claude

---

## Overview

Desktop POS (Point of Sale) application built with Electron for Arabic-language bookstores/stationery shops in Iraq. UI is fully RTL Arabic. Currency is Iraqi Dinar (IQD), stored as integers (no decimals). The app is licensed per-installation using JWT + RSA keypair.

**Store name:** مكتبة الريم  
**Receipt footer note:** البسيط للمبيعات - للاستفسار: 07827626713  
**Target OS:** Windows (NSIS installer), but runs on macOS for development

---

## Running the App

No `npm start` script exists. Use:

```bash
npx electron .
```

To rebuild native modules (sqlite3) after dependency changes or architecture mismatch:

```bash
npx electron-rebuild -f -w sqlite3
```

To build for distribution:

```bash
npx electron-builder
```

---

## File Structure

```
pos/
├── main.js          # Electron main process — window, menu, IPC handlers, license check
├── preload.js       # IPC bridge — exposes window.api to renderer (strict whitelist)
├── renderer.js      # All frontend logic (~1450 lines)
├── index.html       # UI layout — RTL, Arabic, 5-tab sidebar
├── style.css        # Styling — purple sidebar, RTL layout, Cairo font
├── database.js      # SQLite layer — all DB operations as Promise-based methods
├── license.js       # Runtime license manager — verifies JWT with embedded public key
├── admin.js         # CLI tool — generates signed JWT licenses using private key
└── package.json     # Electron 41, sqlite3, jsonwebtoken, electron-store
```

**Private key (outside app bundle):**
```
~/albaseet-license-keys/private.pem
```

---

## Architecture

### Process Model

```
renderer.js (UI)
    ↓ window.api.*
preload.js (IPC bridge)
    ↓ ipcRenderer.invoke('db-*')
main.js (ipcMain.handle)
    ↓
database.js (SQLite)
```

Context isolation is **enabled**. The renderer has zero direct Node.js access — all DB calls go through the IPC bridge. Never add `nodeIntegration: true`.

### Data Flow for a Sale

1. User adds products to cart (`addToCart`)
2. Selects payment method: cash (`نقدي`) or debt (`دين`)
3. For debt: enters partial payment amount (zero is valid = full debt)
4. `processSale()` → `window.api.addSale()` → `window.api.addSaleItem()` per cart item → `window.api.updateStock()` per item
5. If debt: `window.api.updateCustomerDebt()`
6. Receipt printed via `printReceipt()` — opens a new BrowserWindow with inline HTML/CSS

---

## Database Schema

**File location:** `{userData}/stationary_pos.db`

```sql
products (id, name, name_ar, barcode TEXT UNIQUE, price INTEGER, cost INTEGER, stock INTEGER, category, created_at)
sales    (id, customer_id, total INTEGER, paid INTEGER, debt_amount INTEGER, payment_method, sale_date)
sale_items (id, sale_id, product_id, quantity INTEGER, price INTEGER, total INTEGER)
customers  (id, name, phone, address, debt INTEGER, created_at)
debt_payments (id, customer_id, amount INTEGER, payment_date, notes)
```

**Important rules:**
- All monetary values are `INTEGER` (IQD, no decimals). Use `Math.round()` before storing.
- `barcode TEXT UNIQUE` — store `null` (not `""`) for products without a barcode. Use `|| null` when reading the input value.
- `products.barcode` allows multiple NULLs (SQLite treats each NULL as distinct for UNIQUE).

---

## Key Functions in renderer.js

### Cart & Sales
| Function | Description |
|---|---|
| `addToCart(product)` | Adds product or increments quantity; checks stock |
| `updateCartQuantity(productId, delta)` | +/- quantity; removes if reaches 0 |
| `removeFromCart(productId)` | Removes item |
| `handlePayment(method)` | Entry point for checkout; 'cash' or 'debt' |
| `processDebtPayment(paidAmount)` | Handles partial/zero payment for debt sales |
| `processSale(method, customerId, total, paid, debtAmount)` | Final DB writes |
| `printReceipt(...)` | Opens new window, injects HTML receipt, auto-prints |

### Products
| Function | Description |
|---|---|
| `openProductModal(product = null)` | null = add mode, object = edit mode |
| `saveProduct(e)` | Checks `product.id` truthiness to decide add vs update |
| `renderProducts()` | POS grid view |
| `renderProductsTable()` | Inventory table with search/category filter |

### Customers & Debts
| Function | Description |
|---|---|
| `openCustomerModal(customer = null)` | Add/edit customer |
| `renderDebtsList()` | Debt management tab |
| `openDebtPaymentModal(customerId)` | Record a debt payment |
| `saveDebtPayment(e)` | Calls `addDebtPayment` + `updateCustomerDebt` with negative amount |

### License
| Function | Description |
|---|---|
| `checkLicense()` | Calls `window.api.checkLicense()`, shows modal if inactive |
| `activateLicense()` | Reads key from input, calls `window.api.activateLicense()` |
| `enableAppFeatures(enable)` | Disables buttons when license is inactive |

---

## window.api (preload.js bridge)

```javascript
// Products
window.api.getProducts()
window.api.addProduct(product)
window.api.updateProduct(product)
window.api.deleteProduct(id)
window.api.updateStock(productId, quantity)
window.api.getLowStock()

// Customers
window.api.getCustomers()
window.api.addCustomer(customer)
window.api.updateCustomer(customer)
window.api.deleteCustomer(id)
window.api.getCustomerDebt(customerId)
window.api.updateCustomerDebt(customerId, amount)
window.api.addDebtPayment(payment)

// Sales
window.api.getSales()
window.api.addSale(sale)
window.api.addSaleItem(item)
window.api.getSalesReport(startDate, endDate)

// License
window.api.checkLicense()
window.api.activateLicense(key)
window.api.deactivateLicense()
window.api.onLicenseStatus(callback)

// Menu events
window.api.onShowInventory(callback)
window.api.onShowSalesReport(callback)
```

---

## UI Layout (index.html)

**5-tab sidebar (RTL):**
1. **💰 نقطة البيع** — POS: product grid + cart + checkout
2. **📦 المخزون** — Inventory: products table with add/edit/delete
3. **👥 العملاء** — Customers: customer cards with debt info
4. **📊 التقارير** — Reports: date-range sales report
5. **💳 إدارة الديون** — Debts: list of outstanding debts + payment

**Modals:** `#productModal`, `#customerModal`, `#debtPaymentModal`, `#licenseModal`, `#printerModal`

**Notification:** `#notification` — fixed-position toast, shown by `showNotification(msg, type)` where type = `'success'` | `'error'` | `'info'`

---

## Receipt

Receipt is generated as an inline HTML string inside `printReceipt()` in renderer.js. It opens a new `BrowserWindow`, injects the HTML, and auto-prints on load.

**Receipt contains:**
- Store name: `مكتبة الريم`
- Phone: `07819202703`
- Address: `ناحية الزاب - السايدين`
- Invoice number, date, customer info
- Items table (product, qty, unit price, total)
- Subtotal / tax (0%) / grand total
- Amount paid, debt if any, change if cash overpaid
- Footer: `شكراً لزيارتكم`
- Note: `البسيط للمبيعات - للاستفسار: 07827626713`

Paper width: 80mm thermal receipt. Configured via `printerSettings` (stored in electron-store).

---

## License System

### How it works

| Component | Key | Algorithm | Purpose |
|---|---|---|---|
| `admin.js` | `~/albaseet-license-keys/private.pem` | RS256 | Signs JWT |
| `license.js` (app) | Embedded public key | RS256 | Verifies JWT only |

The app **cannot** generate licenses — it only verifies. Extracting the public key from the app binary is useless for forging licenses.

The license JWT is stored encrypted on disk at `{userData}/license.dat` using AES-256-CBC with a separate encryption secret.

### JWT Payload Structure

```json
{
  "customerId": "ALREEM-001",
  "customerName": "مكتبة الريم",
  "issuedAt": "2026-04-04T00:00:00.000Z",
  "expiresAt": "2027-04-04T00:00:00.000Z",
  "durationMonths": 12,
  "features": ["full"]
}
```

### Generating a License

```bash
node admin.js
# Choose option 1 for single license
# Requires private key at ~/albaseet-license-keys/private.pem
```

### License Status Codes

| Code | Meaning |
|---|---|
| `NO_LICENSE` | No license file found |
| `EXPIRED` | Past expiry date |
| `INVALID_TOKEN` | JWT signature invalid |
| `TIME_TAMPER` | System clock moved backwards |
| `ERROR` | Unexpected error |

### Critical: Key Management

- **Private key:** `~/albaseet-license-keys/private.pem` — keep this safe, back it up, never include in the app bundle or git
- If the private key is lost, you cannot issue new licenses (old ones still work until expiry)
- If the private key is leaked, generate a new keypair and update `license.js` public key + rebuild the app (old licenses will stop working)
- When changing the secret key, **delete the existing `license.dat`** from `{userData}` — the old encrypted file won't decrypt with the new key

---

## Known Bugs Fixed

1. **Product replacement bug** (`renderer.js:940`): After editing a product, `form.reset()` may not reliably clear `<input type="hidden" id="productId">` in Electron/Chromium. Fixed by explicitly setting `document.getElementById('productId').value = ''` after `form.reset()`.

2. **Empty barcode UNIQUE constraint** (`renderer.js:954`): Empty barcode `""` violates `barcode TEXT UNIQUE`. Fixed by using `|| null` to convert empty string to NULL.

3. **Zero paid amount for debt sales** (`renderer.js:188`): `paidAmount <= 0` validation rejected zero, preventing full-debt (pay-later) sales. Fixed to `paidAmount < 0`.

---

## Currency & Formatting

- All amounts stored as `INTEGER` (IQD)
- Display format: `Math.round(amount).toLocaleString('ar-IQ') + ' د.ع'`
- Always `Math.round()` before storing to DB
- The `formatIQD(amount)` helper in renderer.js handles display formatting

---

## Adding New Features — Checklist

When adding a new DB-backed feature:

1. **database.js** — add the method returning a Promise
2. **main.js** — add `ipcMain.handle('db-*', ...)` handler
3. **preload.js** — expose via `contextBridge.exposeInMainWorld`
4. **renderer.js** — call `window.api.*` from UI logic

When adding a new UI section:

1. Add tab button in `index.html` sidebar nav
2. Add tab content `<div id="tab-*" class="tab-content">` in `index.html`
3. Handle `switchTab('tab-*')` case in renderer.js (load data on switch)
4. Add any required modals to `index.html`

---

## App Configuration (package.json build)

```json
{
  "appId": "com.stationary.pos",
  "productName": "مكتبتي - نظام نقاط البيع",
  "win": { "target": "nsis", "icon": "icon.ico" }
}
```

The `productName` in package.json (`مكتبتي - نظام نقاط البيع`) is separate from the in-app store name (`مكتبة الريم`). The product name is used for the installer/OS; the store name appears in the UI and receipts.

---

## Files to Never Commit

- `~/albaseet-license-keys/private.pem` — RSA private key
- Any `*.dat` files — encrypted license files
- `*.db` files — customer/sales data
