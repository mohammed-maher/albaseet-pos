const sqlite3 = require('sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class Database {
    constructor() {
        this.isConnected = false;
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'stationary_pos.db');

        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                this.isConnected = false;
            } else {
                console.log('Database connected successfully');
                this.isConnected = true;
                this.initTables();
            }
        });
    }
    // Update database.js - modify table creation
    initTables() {
        const queries = [
            // Products table - use INTEGER for price (in IQD, no decimals)
            `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      barcode TEXT UNIQUE,
      price INTEGER NOT NULL,
      cost INTEGER,
      stock INTEGER DEFAULT 0,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

            // Sales table - use INTEGER for amounts
            `CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      total INTEGER NOT NULL,
      paid INTEGER,
      debt_amount INTEGER,
      payment_method TEXT,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,

            // Sale items table - use INTEGER for prices
            `CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      total INTEGER NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,

            // Customers table
            `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      debt INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

            // Debt payments table
            `CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      amount INTEGER NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`
        ];

        queries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                }
            });
        });

        this.insertSampleData();
    }

    insertSampleData() {
        // Check if products table is empty
        this.db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
            if (err) return;
            if (row.count === 0) {
                const sampleProducts = [
                    ['Notebook', 'دفتر ملاحظات', '123456789', 5000, 3000, 50, 'دفاتر'],
                    ['Blue Pen', 'قلم حبر أزرق', '987654321', 2000, 1000, 100, 'أقلام'],
                    ['Ruler 30cm', 'مسطرة 30 سم', '456789123', 3000, 1500, 30, 'أدوات هندسية'],
                    ['Eraser', 'ممحاة', '789123456', 1000, 500, 80, 'أدوات مكتبية'],
                    ['Calculator', 'آلة حاسبة', '321654987', 15000, 10000, 20, 'آلات حاسبة'],
                    ['Color Pencils', 'ألوان خشبية', '654987321', 8000, 5000, 40, 'أدوات فنية'],
                    ['Scissors', 'مقص', '147258369', 4000, 2000, 25, 'أدوات مكتبية'],
                    ['Glue', 'غراء', '258369147', 2500, 1000, 35, 'لوازم']
                ];

                const insertStmt = this.db.prepare('INSERT INTO products (name, name_ar, barcode, price, cost, stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)');

                sampleProducts.forEach(product => {
                    insertStmt.run(product, (err) => {
                        if (err) console.error('Error inserting sample product:', err);
                    });
                });

                insertStmt.finalize();
            }
        });

        // Sample customers with integer debt
        this.db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
            if (err) return;
            if (row.count === 0) {
                const sampleCustomers = [
                    ['أحمد محمد', '0501234567', 'الشارع الرئيسي', 0],
                    ['سارة عبدالله', '0507654321', 'المنطقة السكنية', 0],
                    ['محمد علي', '0551234567', 'الحي الغربي', 0],
                    ['فاطمة حسن', '0561234567', 'الحي الشرقي', 0]
                ];

                const insertStmt = this.db.prepare('INSERT INTO customers (name, phone, address, debt) VALUES (?, ?, ?, ?)');

                sampleCustomers.forEach(customer => {
                    insertStmt.run(customer, (err) => {
                        if (err) console.error('Error inserting sample customer:', err);
                    });
                });

                insertStmt.finalize();
            }
        });
    }
    // Product operations
    getProducts() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM products ORDER BY name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    addProduct(product) {
        return new Promise((resolve, reject) => {
            const { name, name_ar, barcode, price, cost, stock, category } = product;
            this.db.run(
                'INSERT INTO products (name, name_ar, barcode, price, cost, stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [name, name_ar, barcode, price, cost, stock, category],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...product });
                }
            );
        });
    }

    updateProduct(product) {
        return new Promise((resolve, reject) => {
            const { id, name, name_ar, barcode, price, cost, stock, category } = product;
            this.db.run(
                'UPDATE products SET name=?, name_ar=?, barcode=?, price=?, cost=?, stock=?, category=? WHERE id=?',
                [name, name_ar, barcode, price, cost, stock, category, id],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id, ...product });
                }
            );
        });
    }

    deleteProduct(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM products WHERE id=?', [id], function(err) {
                if (err) reject(err);
                else resolve({ success: true });
            });
        });
    }

    updateStock(productId, quantity) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE products SET stock = stock - ? WHERE id=? AND stock >= ?',
                [quantity, productId, quantity],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    }

    getLowStockProducts(threshold) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM products WHERE stock <= ? ORDER BY stock ASC',
                [threshold],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Customer operations
    getCustomers() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM customers ORDER BY name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    addCustomer(customer) {
        return new Promise((resolve, reject) => {
            const { name, phone, address, debt } = customer;
            this.db.run(
                'INSERT INTO customers (name, phone, address, debt) VALUES (?, ?, ?, ?)',
                [name, phone, address, debt || 0],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...customer });
                }
            );
        });
    }

    updateCustomer(customer) {
        return new Promise((resolve, reject) => {
            const { id, name, phone, address, debt } = customer;
            this.db.run(
                'UPDATE customers SET name=?, phone=?, address=?, debt=? WHERE id=?',
                [name, phone, address, debt, id],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id, ...customer });
                }
            );
        });
    }

    deleteCustomer(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM customers WHERE id=?', [id], function(err) {
                if (err) reject(err);
                else resolve({ success: true });
            });
        });
    }

    getCustomerDebt(customerId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT debt FROM customers WHERE id=?',
                [customerId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.debt : 0);
                }
            );
        });
    }

    updateCustomerDebt(customerId, amount) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE customers SET debt = debt + ? WHERE id=?',
                [amount, customerId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    }

    addDebtPayment(payment) {
        return new Promise((resolve, reject) => {
            const { customer_id, amount, notes } = payment;
            const db = this.db; // Store reference
            const updateCustomerDebt = this.updateCustomerDebt.bind(this); // Bind method

            db.run(
                'INSERT INTO debt_payments (customer_id, amount, notes) VALUES (?, ?, ?)',
                [customer_id, amount, notes || ''],
                function(err) {
                    if (err) reject(err);
                    else {
                        // Update customer debt
                        updateCustomerDebt(customer_id, -amount)
                            .then(() => resolve({ id: this.lastID, ...payment }))
                            .catch(reject);
                    }
                }
            );
        });
    }
    // Sales operations
    getSales() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT s.*, c.name as customer_name 
         FROM sales s 
         LEFT JOIN customers c ON s.customer_id = c.id 
         ORDER BY s.sale_date DESC 
         LIMIT 100`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    addSale(sale) {
        return new Promise((resolve, reject) => {
            const { customer_id, total, paid, debt_amount, payment_method } = sale;
            this.db.run(
                'INSERT INTO sales (customer_id, total, paid, debt_amount, payment_method) VALUES (?, ?, ?, ?, ?)',
                [customer_id || null, total, paid, debt_amount || 0, payment_method],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...sale });
                }
            );
        });
    }

    addSaleItem(item) {
        return new Promise((resolve, reject) => {
            const { sale_id, product_id, quantity, price, total } = item;
            this.db.run(
                'INSERT INTO sale_items (sale_id, product_id, quantity, price, total) VALUES (?, ?, ?, ?, ?)',
                [sale_id, product_id, quantity, price, total],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...item });
                }
            );
        });
    }

    getSalesReport(startDate, endDate) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
          s.*,
          c.name as customer_name,
          COUNT(si.id) as items_count
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         LEFT JOIN sale_items si ON s.id = si.sale_id
         WHERE date(s.sale_date) BETWEEN date(?) AND date(?)
         GROUP BY s.id
         ORDER BY s.sale_date DESC`,
                [startDate, endDate],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
    async backupDatabase() {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'stationary_pos.db');
        const backupPath = path.join(userDataPath, `backup_${Date.now()}.db`);

        return new Promise((resolve, reject) => {
            this.db.backup(backupPath, (err) => {
                if (err) reject(err);
                else resolve(backupPath);
            });
        });
    }
}

module.exports = Database;