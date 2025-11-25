# Tea-supply-tracker
A simple, offline-friendly mobile web app designed to help track tea-supply customers, orders, payments, pending balances, and full customer history.
This project is made for real small-business use: fast, clean UI, large readable text, and works even without internet.

📌 Features
✔ Offline Support (PWA)

Installs like an app on phone (Android/iOS) and laptop.

Loads instantly, even without internet.

Saves all data locally using IndexedDB.

✔ Customer Auto-Save

Once a customer is added (name, phone, business, address), you never need to type again.

Search by name, phone, business name, or address — autofill completes details instantly.

✔ Order Tracking

Each entry includes:

Date

KG given

Price per KG

Total amount auto-calculated

Payment options:

Paid by Cash

Paid by Online

Mixed payment (auto calculates remaining)

OR leave payment empty if they will pay later

✔ Pending Payments Page

Shows:

Customer name

Phone

Business

Total remaining payment

When user pays something, you update the entry and it recalculates remaining.

✔ Full Customer History

Every sale logged (date, kg, rate, total)

Every payment logged

Shows complete history from first day to last

When a customer clears full balance, they move from Pending → History

✔ Total Tea Powder Sold Today

Automatically shows how much KG sold today.

✔ Google Sign-In (Identity Only)

Used to identify the user and sync features across devices later.
