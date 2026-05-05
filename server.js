const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

const JWT_SECRET = 'mysecretkey123';
const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'e_commerce',
    waitForConnections: true,
    connectionLimit: 10,
}).promise();

db.getConnection()
    .then(conn => { console.log('Connected to e_commerce database.');
        conn.release(); })
    .catch(err => { console.error('Database connection failed:', err.message); });

// ── Register ───────────────────────────────────────────────
app.post('/api/register', async(req, res) => {
    const { first_name, last_name, email, password, phone } = req.body;
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    try {
        const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already registered.' });
        }
        const password_hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (first_name, last_name, email, password_hash, phone) VALUES (?, ?, ?, ?, ?)', [first_name, last_name, email, password_hash, phone]
        );
        res.status(201).json({ message: 'Account created successfully.', user_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Login ──────────────────────────────────────────────────
app.post('/api/login', async(req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role },
            JWT_SECRET, { expiresIn: '7d' }
        );
        res.json({
            message: 'Login successful.',
            token,
            user: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Products ───────────────────────────────────────────────
app.get('/api/products', async(req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.product_id, p.name, p.description,
                   c.slug AS cat, pv.variant_id,
                   pv.price, pv.stock_qty AS stock, pv.image_url AS img
            FROM products p
            JOIN categories       c  ON p.category_id = c.category_id
            JOIN product_variants pv ON p.product_id  = pv.product_id
            WHERE p.is_active = 1
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Cart ───────────────────────────────────────────────────
app.post('/api/cart/add', async(req, res) => {
    const { user_id, variant_id, quantity } = req.body;
    try {
        let [cart] = await db.query('SELECT cart_id FROM cart WHERE user_id = ?', [user_id]);
        if (cart.length === 0) {
            const [result] = await db.query('INSERT INTO cart (user_id) VALUES (?)', [user_id]);
            cart = [{ cart_id: result.insertId }];
        }
        const cart_id = cart[0].cart_id;
        await db.query(`
            INSERT INTO cart_items (cart_id, variant_id, quantity)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
        `, [cart_id, variant_id, quantity]);
        res.json({ message: 'Item added to cart' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/cart/:user_id', async(req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT ci.cart_item_id, p.name, pv.shade, pv.size_ml, pv.price, ci.quantity
            FROM cart_items ci
            JOIN cart             c  ON ci.cart_id   = c.cart_id
            JOIN product_variants pv ON ci.variant_id = pv.variant_id
            JOIN products         p  ON pv.product_id = p.product_id
            WHERE c.user_id = ?
        `, [req.params.user_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Wishlist ───────────────────────────────────────────────
app.post('/api/wishlist/add', async(req, res) => {
    const { user_id, product_id } = req.body;
    try {
        await db.query(
            'INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)', [user_id, product_id]
        );
        res.json({ message: 'Added to wishlist' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/wishlist/:user_id', async(req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT w.wishlist_id, p.product_id, p.name, p.slug
            FROM wishlist w
            JOIN products p ON w.product_id = p.product_id
            WHERE w.user_id = ?
        `, [req.params.user_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Orders ─────────────────────────────────────────────────
app.post('/api/orders', async(req, res) => {
    const { user_id, address, items, subtotal, total_amount, payment_method } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in order.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [addrResult] = await conn.query(
            `INSERT INTO user_addresses (user_id, address_line, city, postal_code) VALUES (?, ?, ?, ?)`, [user_id || null, address.line, address.city, address.postcode]
        );
        const [orderResult] = await conn.query(
            `INSERT INTO orders (user_id, address_id, subtotal, total_amount, payment_method, status)
             VALUES (?, ?, ?, ?, ?, 'confirmed')`, [user_id || null, addrResult.insertId, subtotal, total_amount, payment_method || 'card']
        );
        const order_id = orderResult.insertId;
        for (const item of items) {
            await conn.query(
                `INSERT INTO order_items (order_id, variant_id, product_name, quantity, unit_price)
                 VALUES (?, ?, ?, ?, ?)`, [order_id, item.variant_id, item.name, item.qty, item.price]
            );
            await conn.query(
                `UPDATE product_variants SET stock_qty = stock_qty - ?
                 WHERE variant_id = ? AND stock_qty >= ?`, [item.qty, item.variant_id, item.qty]
            );
        }
        await conn.commit();
        res.status(201).json({ message: 'Order placed.', order_id, ref: 'MN-' + order_id.toString(36).toUpperCase() });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});