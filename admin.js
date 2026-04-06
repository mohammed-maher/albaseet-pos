const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LicenseGenerator {
    constructor() {
        const keyPath = path.join(os.homedir(), 'albaseet-license-keys', 'private.pem');
        if (!fs.existsSync(keyPath)) {
            throw new Error(`Private key not found at: ${keyPath}`);
        }
        this.privateKey = fs.readFileSync(keyPath, 'utf8');
    }

    generateLicense(customerName, durationMonths, customerId = null, features = ['full']) {
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

        // Create JWT payload with explicit expiration
        const payload = {
            customerId: customerId || customerName.replace(/\s/g, '').toUpperCase(),
            customerName: customerName,
            issuedAt: now.toISOString(),
            expiresAt: expiryDate.toISOString(),
            durationMonths: durationMonths,
            features: features
        };

        // Don't use expiresIn option - just sign the token
        const token = jwt.sign(payload, this.privateKey, {
            algorithm: 'RS256'
        });

        return {
            licenseKey: token,
            payload: payload,
            expiryDate: expiryDate
        };
    }

    verifyLicense(licenseKey) {
        try {
            // Verify the signature only
            const decoded = jwt.verify(licenseKey, this.privateKey, { algorithms: ['RS256'] });

            // Manually check expiration
            const expiryDate = new Date(decoded.expiresAt);
            const now = new Date();

            if (now > expiryDate) {
                console.log('\n=== License Verification ===');
                console.log('❌ License expired');
                console.log(`Expired on: ${expiryDate.toLocaleDateString()}`);
                console.log('===========================\n');
                return { valid: false, error: 'License expired' };
            }

            console.log('\n=== License Verification ===');
            console.log('✅ License is valid');
            console.log('Customer:', decoded.customerName);
            console.log('Expires:', new Date(decoded.expiresAt).toLocaleDateString());
            console.log('Features:', decoded.features.join(', '));
            console.log('===========================\n');
            return { valid: true, decoded };
        } catch (error) {
            console.log('\n=== License Verification ===');
            console.log('❌ Invalid license:', error.message);
            console.log('===========================\n');
            return { valid: false, error: error.message };
        }
    }

    printLicense(license) {
        console.log('\n' + '='.repeat(60));
        console.log('🔑 LICENSE KEY');
        console.log('='.repeat(60));
        console.log(`Customer: ${license.payload.customerName}`);
        console.log(`License Key: ${license.licenseKey}`);
        console.log(`Expires: ${license.expiryDate.toLocaleDateString('ar-IQ')}`);
        console.log(`Duration: ${license.payload.durationMonths} months`);
        console.log(`Features: ${license.payload.features.join(', ')}`);
        console.log('='.repeat(60) + '\n');

        this.verifyLicense(license.licenseKey);
    }
}
// CLI Interface
if (require.main === module) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const generator = new LicenseGenerator();

    console.log('\n=== JWT License Generator Tool ===\n');
    console.log('1. Generate single license');
    console.log('2. Verify existing license');
    console.log('3. Generate bulk licenses from CSV');
    console.log('4. Exit');
    console.log('');

    rl.question('Choose option (1-4): ', (option) => {
        if (option === '1') {
            rl.question('Customer Name: ', (name) => {
                rl.question('Duration (months) [6]: ', (months) => {
                    const duration = parseInt(months) || 6;
                    rl.question('Customer ID (optional): ', (id) => {
                        const license = generator.generateLicense(name, duration, id || null);
                        generator.printLicense(license);

                        rl.question('Save to file? (y/n): ', (save) => {
                            if (save.toLowerCase() === 'y') {
                                const filename = `license_${license.payload.customerId}_${Date.now()}.txt`;
                                fs.writeFileSync(filename, license.licenseKey);
                                console.log(`\n✅ License saved to: ${filename}`);
                            }
                            rl.close();
                        });
                    });
                });
            });
        } else if (option === '2') {
            rl.question('Enter license key: ', (key) => {
                generator.verifyLicense(key);
                rl.close();
            });
        } else if (option === '3') {
            rl.question('CSV file path (format: Name,Duration,ID): ', (file) => {
                const licenses = generator.generateBulkFromCSV(file);
                generator.exportLicenses(licenses);
                rl.close();
            });
        } else {
            rl.close();
        }
    });
}

module.exports = LicenseGenerator;