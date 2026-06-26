// v3 demo: 用 localStorage 模拟原 shop-api 服务器
// 拦截所有以 /api/ 开头的 fetch 请求，避免依赖外部后端。
(function () {
    'use strict';

    const KEY = {
        balance: 'demo_user_balance',
        products: 'demo_shop_products',
        orders: 'demo_shop_orders',
        bag: 'demo_user_bag',
        transactions: 'demo_user_transactions'
    };

    const DEFAULT_BALANCE = { gold: 5000, star: 100 };

    let defaultProductsPromise = null;
    function loadDefaultProducts() {
        if (!defaultProductsPromise) {
            defaultProductsPromise = originalFetch('data/products.example.json')
                .then(r => r.json())
                .catch(err => {
                    console.error('[demo] 读取示例商品数据失败:', err);
                    return [];
                });
        }
        return defaultProductsPromise;
    }

    function read(key, fallback) {
        try {
            const s = localStorage.getItem(KEY[key]);
            return s ? JSON.parse(s) : fallback;
        } catch (e) {
            return fallback;
        }
    }
    function write(key, value) {
        localStorage.setItem(KEY[key], JSON.stringify(value));
    }

    function appendTxn(entry) {
        const list = read('transactions', []);
        const txn = Object.assign({
            transactionId: 'TXN' + Date.now() + Math.floor(Math.random() * 1000),
            time: new Date().toISOString()
        }, entry);
        list.unshift(txn);
        write('transactions', list);
        return txn;
    }

    async function ensureProducts() {
        let products = read('products', null);
        if (!Array.isArray(products) || products.length === 0) {
            products = await loadDefaultProducts();
            write('products', products);
        }
        return products;
    }

    async function handle(method, path, search, body) {
        if (path === '/api/balance') {
            if (method === 'GET') {
                return { success: true, data: read('balance', DEFAULT_BALANCE) };
            }
            if (method === 'PUT') {
                const before = read('balance', DEFAULT_BALANCE);
                const { description, type, ...balanceFields } = body || {};
                const merged = { ...before, ...balanceFields };
                write('balance', merged);
                const reason = description || '管理员调整';
                const txnType = type || 'admin_adjust';
                ['gold', 'star'].forEach(k => {
                    if (typeof balanceFields[k] === 'number' && balanceFields[k] !== before[k]) {
                        appendTxn({
                            type: txnType,
                            currency: k === 'gold' ? '金币' : '星星',
                            amount: merged[k] - before[k],
                            beforeBalance: before[k],
                            afterBalance: merged[k],
                            description: reason
                        });
                    }
                });
                return { success: true, data: merged };
            }
        }

        if (path === '/api/products') {
            if (method === 'GET') {
                return { success: true, data: await ensureProducts() };
            }
            if (method === 'PUT') {
                if (!Array.isArray(body)) {
                    return { success: false, message: '数据格式错误，需要数组' };
                }
                write('products', body);
                return { success: true, message: '保存成功', count: body.length };
            }
        }

        if (path === '/api/orders') {
            if (method === 'GET') {
                return { success: true, data: read('orders', []) };
            }
            if (method === 'POST') {
                const orders = read('orders', []);
                const products = await ensureProducts();
                const balance = read('balance', DEFAULT_BALANCE);
                const order = body || {};

                if (order.priceType === '金币' && balance.gold < order.productPrice) {
                    return { success: false, message: '金币余额不足' };
                }
                if (order.priceType === '宝石' && balance.star < order.productPrice) {
                    return { success: false, message: '星星余额不足' };
                }

                const idx = products.findIndex(p => String(p.productId) === String(order.productId));
                if (idx === -1) {
                    return { success: false, message: '商品不存在' };
                }
                const product = products[idx];
                const consumed = product.consumedStock || 0;
                const total = product.totalStock || 100;
                if (total - consumed <= 0) {
                    return { success: false, message: '库存不足' };
                }
                products[idx].consumedStock = consumed + 1;

                if (order.priceType === '金币') balance.gold -= order.productPrice;
                else balance.star -= order.productPrice;

                if (!order.orderId) order.orderId = 'ORD' + Date.now().toString().slice(-10);
                order.purchaseTime = new Date().toISOString();
                order.beforeBalance = order.priceType === '金币'
                    ? balance.gold + order.productPrice
                    : balance.star + order.productPrice;
                order.afterBalance = order.priceType === '金币' ? balance.gold : balance.star;

                orders.unshift(order);
                write('orders', orders);
                write('products', products);
                write('balance', balance);

                const bag = read('bag', []);
                const bagItem = {
                    productId: product.productId,
                    productName: product.productName,
                    imageUrl: product.imageUrl,
                    priceType: order.priceType,
                    priceAmount: order.productPrice,
                    category: product.category,
                    subcategory: product.subcategory,
                    purchasedAt: new Date().toISOString(),
                    quantity: 1,
                    mountConfig: product.mountConfig || { x: 0, y: 0, scale: 100, rotation: 0 }
                };
                const bagIdx = bag.findIndex(i => String(i.productId) === String(product.productId));
                if (bagIdx > -1) {
                    bag[bagIdx].quantity += 1;
                    bag[bagIdx].purchasedAt = new Date().toISOString();
                } else {
                    bag.push(bagItem);
                }
                write('bag', bag);

                appendTxn({
                    type: 'purchase',
                    currency: order.priceType,
                    amount: -Number(order.productPrice),
                    beforeBalance: order.beforeBalance,
                    afterBalance: order.afterBalance,
                    description: '购买 ' + order.productName,
                    relatedOrderId: order.orderId
                });

                return { success: true, data: order, balance };
            }
        }

        if (path === '/api/bag') {
            if (method === 'GET') return { success: true, data: read('bag', []) };
            if (method === 'POST') {
                const bag = read('bag', []);
                const item = body || {};
                const idx = bag.findIndex(i => i.productId === item.productId);
                if (idx > -1) bag[idx] = { ...bag[idx], ...item, savedAt: new Date().toISOString() };
                else { item.savedAt = new Date().toISOString(); bag.push(item); }
                write('bag', bag);
                return { success: true, message: '保存成功' };
            }
        }

        if (path === '/api/bag/' || path.startsWith('/api/bag/')) {
            if (method === 'DELETE') {
                const productId = path.replace('/api/bag/', '');
                const bag = read('bag', []);
                const idx = bag.findIndex(i => String(i.productId) === String(productId));
                if (idx === -1) return { success: false, message: '商品不在背包中' };
                const removed = bag.splice(idx, 1);
                write('bag', bag);
                return { success: true, message: '删除成功', removed: removed[0] };
            }
        }

        if (path === '/api/transactions') {
            if (method === 'GET') {
                let list = read('transactions', []);
                const currency = search.get('currency');
                const type = search.get('type');
                const limit = search.get('limit');
                if (currency) list = list.filter(t => t.currency === currency);
                if (type) list = list.filter(t => t.type === type);
                if (limit) list = list.slice(0, Number(limit));
                return { success: true, data: list };
            }
        }

        return { success: false, message: 'demo: 未实现的 API: ' + method + ' ' + path };
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
        const rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
        const isApi = rawUrl.startsWith('/api/') || rawUrl.includes('/api/');
        if (!isApi) return originalFetch(input, init);

        let pathname, search;
        try {
            const u = new URL(rawUrl, location.origin);
            pathname = u.pathname;
            search = u.searchParams;
        } catch (e) {
            return originalFetch(input, init);
        }

        const method = ((init && init.method) || 'GET').toUpperCase();
        let body = null;
        if (init && init.body) {
            try { body = JSON.parse(init.body); } catch (e) { body = init.body; }
        }

        try {
            const result = await handle(method, pathname, search, body);
            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error('[demo-api]', err);
            return new Response(JSON.stringify({ success: false, message: String(err) }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    };

    console.log('[demo-api] localStorage shim 已启用');
})();
