Tea-supply-tracker

A clean, mobile-friendly, offline-first Progressive Web App (PWA) to manage tea powder supply, track customer history, and monitor pending payments. Perfect for tea sellers who prefer digital convenience over notebooks—no need to carry one around!

Built with HTML, CSS, JavaScript, and IndexedDB, it works seamlessly online and offline, and can be installed as an app on your device.

⭐ Features

✅ 1. Works Offline (PWA)

Loads instantly, even without internet
Can be installed on Android, iOS, and Desktop
Data is stored safely in IndexedDB (never lost)

✅ 2. Add Supply Entries

Customer name & phone number (auto-saved for future use)
Business name & address
Date, KGs, price per KG
Auto-calculated total
Payment type selection
Mixed payment handling with automatic balance calculation

✅ 3. Smart Customer Autofill

Search by name, phone, business, or address
Existing customer details auto-fill
No repeated typing required

✅ 4. Pending Payment Tracking

Automatically calculates total remaining amount
Multiple orders accumulate
Shows list of customers who owe money
Tap a customer to see full payment history

✅ 5. Full Customer History

View every supply entry:

Date
KG taken
Total amount
Paid amount
Remaining balance
Entries move to History once payment is fully cleared

✅ 6. Contact List Integration (Optional)

Auto-reads phone contacts (browser-supported devices only)

✅ 7. Google Login (Optional)

Only for identity sync across devices

📁 Project Structure:

tea-supply-tracker/
│
├─ index.html        # Main PWA interface
├─ style.css         # Styles for responsive, mobile-friendly design
├─ app.js            # Core JavaScript logic for entries, autofill, payments
├─ service-worker.js # Enables offline PWA functionality
├─ manifest.json     # PWA metadata for install-as-app
└─ db.js             # IndexedDB management for offline storage
