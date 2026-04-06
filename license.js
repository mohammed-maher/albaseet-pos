const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class LicenseManager {
    constructor() {
        this.licenseFilePath = path.join(app.getPath('userData'), 'license.dat');
        this.licenseData = null;
        this.lastCheckTime = null;
        this.tamperDetected = false;

        this.publicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApj2xSh8ubY46V+qigaPi\nbhNLkm95fWfGC6SlqytaxhHhexWipRAcWwcq91hLn9rQoxoxixSBTHnPv+m+Rh8N\n01ySCpgHpTnHlo0CK+YtGV47H+Ft1dMNDiqm8cN/416f8rYstVgx0fu+Fl8v1GDo\nbcJ6KnOXN7Lhcgm2nJ6Rk3RHkAgE/q02MzxCXNQUYNYakJLbsTi99Wvh4R7Bkhmk\neVdDOJZsIX02x2lPxtsU2WwwAXOfYoAgwEoMeM5PMr6YBzhlFSfUMk2b8EheVgLd\n/jMjTQt06L5rTyHhOuIT73u7g3kSU/fwJFJgi/seeq7+jI/NXi+Tu6eleDAZvdxZ\nFQIDAQAB\n-----END PUBLIC KEY-----`;
        // Encryption key for license file storage (separate from signing)
        this.encryptionSecret = 'd9b271a89b2a8d7b7303ea5bcaf82c37494bed6f6fbaf635a995504054c9c2448717fe7595f4646a06a39a89642d4f2b5d9addbcd77c9b7aad45aa879bf2ea6f';
    }

    // Save license token to file
    saveLicense(token) {
        try {
            // Encrypt the token before saving (optional but recommended)
            const encryptedToken = this.encryptData(token);
            fs.writeFileSync(this.licenseFilePath, encryptedToken, 'utf8');
            return true;
        } catch (error) {
            console.error('Error saving license:', error);
            return false;
        }
    }

    // Load license token from file
    loadLicense() {
        try {
            if (fs.existsSync(this.licenseFilePath)) {
                const encryptedToken = fs.readFileSync(this.licenseFilePath, 'utf8');
                const token = this.decryptData(encryptedToken);
                this.licenseData = token;
                return token;
            }
        } catch (error) {
            console.error('Error loading license:', error);
        }
        return null;
    }

    // Encrypt data (optional but adds extra security)
    encryptData(data) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionSecret + '_encrypt', 'salt', 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
    }

    // Decrypt data
    decryptData(encryptedData) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionSecret + '_encrypt', 'salt', 32);
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    // Check for time tampering
    checkTimeTampering() {
        const currentTime = Date.now();

        if (this.lastCheckTime) {
            if (currentTime < this.lastCheckTime) {
                this.tamperDetected = true;
                console.warn('Time tampering detected!');
                return false;
            }
        }

        this.lastCheckTime = currentTime;
        return true;
    }

    // Validate license using JWT
// In license.js - validateLicense method
    validateLicense() {
        try {
            if (!this.licenseData) {
                this.loadLicense();
            }

            if (!this.checkTimeTampering()) {
                return {
                    valid: false,
                    reason: 'تم اكتشاف تغيير في تاريخ الجهاز',
                    code: 'TIME_TAMPER'
                };
            }

            if (!this.licenseData) {
                return {
                    valid: false,
                    reason: 'لا يوجد ترخيص',
                    code: 'NO_LICENSE'
                };
            }

            // Verify JWT signature
            const decoded = jwt.verify(this.licenseData, this.publicKey, { algorithms: ['RS256'] });

            // Manually check expiration from our custom field
            const expiryDate = new Date(decoded.expiresAt);
            const now = new Date();

            if (now > expiryDate) {
                return {
                    valid: false,
                    reason: 'انتهت صلاحية الترخيص',
                    code: 'EXPIRED'
                };
            }

            const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

            return {
                valid: true,
                expiresAt: expiryDate,
                daysRemaining: daysRemaining,
                customerName: decoded.customerName,
                customerId: decoded.customerId,
                features: decoded.features || ['full']
            };

        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return {
                    valid: false,
                    reason: 'الترخيص غير صالح',
                    code: 'INVALID_TOKEN'
                };
            } else {
                console.error('Error validating license:', error);
                return {
                    valid: false,
                    reason: 'خطأ في التحقق من الترخيص',
                    code: 'ERROR'
                };
            }
        }
    }

    // Activate license with JWT token
    activateLicense(licenseToken) {
        try {
            // First verify the token is valid
            const decoded = jwt.verify(licenseToken, this.publicKey, { algorithms: ['RS256'] });

            // Check if not expired
            const expiryDate = new Date(decoded.expiresAt);
            const now = new Date();

            if (now > expiryDate) {
                return {
                    success: false,
                    message: 'مفتاح الترخيص منتهي الصلاحية'
                };
            }

            // Save the token
            if (this.saveLicense(licenseToken)) {
                this.licenseData = licenseToken;
                const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                return {
                    success: true,
                    message: 'تم تفعيل الترخيص بنجاح',
                    expiryDate: expiryDate,
                    daysRemaining: daysRemaining,
                    customerName: decoded.customerName
                };
            } else {
                return {
                    success: false,
                    message: 'فشل في حفظ الترخيص'
                };
            }

        } catch (error) {
            console.error('Error activating license:', error);
            if (error.name === 'TokenExpiredError') {
                return {
                    success: false,
                    message: 'مفتاح الترخيص منتهي الصلاحية'
                };
            } else if (error.name === 'JsonWebTokenError') {
                return {
                    success: false,
                    message: 'مفتاح الترخيص غير صالح'
                };
            } else {
                return {
                    success: false,
                    message: 'حدث خطأ في تفعيل الترخيص'
                };
            }
        }
    }

    // Get license status
    getLicenseStatus() {
        const validation = this.validateLicense();

        if (validation.valid) {
            return {
                status: 'active',
                daysRemaining: validation.daysRemaining,
                expiresAt: validation.expiresAt,
                customerName: validation.customerName
            };
        } else {
            return {
                status: 'inactive',
                reason: validation.reason,
                code: validation.code
            };
        }
    }

    // Deactivate license
    deactivateLicense() {
        try {
            if (fs.existsSync(this.licenseFilePath)) {
                fs.unlinkSync(this.licenseFilePath);
            }
            this.licenseData = null;
            return true;
        } catch (error) {
            console.error('Error deactivating license:', error);
            return false;
        }
    }
}

module.exports = LicenseManager;