/* ==========================================================================
   1. ESTADO GLOBAL
   ========================================================================== */
let products = [];
let cart = []; 
let currentCategory = 'all';
let currentActiveProd = null;
let selectedSizeStr = "";
let qty = 1;

/* ==========================================================================
   2. EVENTOS DE CARGA E INICIALIZACIÓN
   ========================================================================== */
async function cargarProductos() {
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true); 

    if (error) {
        console.error("Error cargando productos:", error);
    } else {
        // Mezcla aleatoria para dinamismo en el catálogo
        products = data ? data.sort(() => Math.random() - 0.5) : [];
        renderStore();
    }
}

// Sincronización en tiempo real con Supabase
if (typeof supabaseClient !== 'undefined') {
    supabaseClient.channel('custom-all-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => {
            cargarProductos();
        }).subscribe();
}

// Inicialización de la App
document.addEventListener('DOMContentLoaded', () => {
    // Recuperar carrito local previo
    const savedCart = localStorage.getItem('alejandro_cart');
    if (savedCart) {
        try { cart = JSON.parse(savedCart); } catch (e) { cart = []; }
    }
    
    cargarProductos();
    updateCartUI();

    // Evento para cerrar el modal haciendo clic fuera de él
    const modalElement = document.getElementById('productModal');
    if (modalElement) {
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) closeProductModal();
        });
    }
});

/* ==========================================================================
   3. FUNCIONES DEL CATÁLOGO (RENDER, FILTROS, BÚSQUEDA)
   ========================================================================== */
function renderStore() {
    const grid = document.getElementById('storeGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let filtered = products;

    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.categoria === currentCategory);
    }

    const searchBar = document.getElementById('searchBar');
    const query = searchBar ? searchBar.value.trim().toLowerCase() : '';
    if (query !== '') {
        filtered = filtered.filter(p => p.nombre.toLowerCase().includes(query));
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="store-empty-msg">No se encontraron artículos en esta sección.</p>`;
        return;
    }

    filtered.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const itemImg = p.imagen ? p.imagen : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="background:%23e2e8f0;"><text x="50%" y="55%" font-family="sans-serif" font-size="10" fill="%2364748b" text-anchor="middle">Sin Foto</text></svg>';
        const btnText = p.categoria === 'belleza' ? 'Ver servicio →' : 'Ver detalles →';

        card.innerHTML = `
            <div class="prod-img-box">
                <img src="${itemImg}" alt="${p.nombre}">
            </div>
            <div class="prod-info">
                <h3 class="prod-title">${p.nombre}</h3>
                <div class="prod-meta">
                    <span class="prod-price">$${Number(p.precio).toFixed(2)}</span>
                </div>
                <button class="order-btn" onclick="openProductModal('${p.id}')">
                    ${btnText}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-card').forEach(card => card.classList.remove('active'));
    const targetCard = document.querySelector(`[data-cat="${cat}"]`);
    if (targetCard) targetCard.classList.add('active');
    renderStore();
}

function searchProducts() {
    renderStore();
}

/* ==========================================================================
   4. MODAL DE PRODUCTO (CONTROL DE STOCK, INTERFAZ Y VARIANTES)
   ========================================================================== */
function openProductModal(prodId) {
    currentActiveProd = products.find(p => String(p.id) === String(prodId));
    if (!currentActiveProd) return;

    // 1. Resetear valores base
    qty = 1;
    document.getElementById('qtyVal').innerText = qty;

    // 2. Inyectar Textos e Imagen Básica
    document.getElementById('modalTitle').innerText = currentActiveProd.nombre;
    document.getElementById('modalPrice').innerText = '$' + Number(currentActiveProd.precio).toFixed(2);
    
    const modalImg = document.getElementById('modalImg');
    if (modalImg) {
        modalImg.src = currentActiveProd.imagen ? currentActiveProd.imagen : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="background:%23e2e8f0;"><text x="50%" y="55%" font-family="sans-serif" font-size="10" fill="%2364748b" text-anchor="middle">Sin Foto</text></svg>';
    }

    // 3. Renderizado y Limpieza del Bloque de Stock
    const stock = currentActiveProd.stock || 0;
    let stockDisplay = document.getElementById('modalStock');
    if (!stockDisplay) {
        stockDisplay = document.createElement('p');
        stockDisplay.id = 'modalStock';
        stockDisplay.className = 'modal-stock-info';
        const priceLabel = document.getElementById('modalPrice');
        if (priceLabel) priceLabel.insertAdjacentElement('afterend', stockDisplay);
    }

    const cartBtn = document.getElementById('addToCartBtn');
    const qtyArea = document.getElementById('qtyArea');

    // 4. Lógica de comportamiento según categoría (Servicios vs Productos Físicos)
    if (currentActiveProd.categoria === 'belleza') {
        stockDisplay.style.display = 'none';
        if (qtyArea) qtyArea.style.display = 'none'; 
        if (cartBtn) {
            cartBtn.disabled = false;
            cartBtn.style.backgroundColor = 'var(--whatsapp)'; // Forzar verde WhatsApp
            cartBtn.innerHTML = `<span>Consultar Cita por WhatsApp →</span>`;
        }
    } else {
        stockDisplay.style.display = 'block';
        if (cartBtn) cartBtn.style.backgroundColor = ''; // Restablecer al color azul original

        if (stock > 0) {
            stockDisplay.innerHTML = `Disponibles: ${stock}`;
            if (qtyArea) qtyArea.style.display = 'flex';
            if (cartBtn) {
                cartBtn.disabled = false;
                cartBtn.innerHTML = `<span>Agregar al carrito de compras</span>`;
            }
        } else {
            stockDisplay.innerHTML = `<span class="stock-out">❌ AGOTADO</span>`;
            if (qtyArea) qtyArea.style.display = 'none';
            if (cartBtn) {
                cartBtn.disabled = true;
                cartBtn.innerHTML = `<span>Agotado</span>`;
            }
        }
    }

    // 5. Textos informativos dinámicos de las etiquetas superiores
    const modalDesc = document.querySelector('.modal-product-desc');
    const variantLabel = document.getElementById('variantLabel');

    if (currentActiveProd.categoria === 'juguetes') {
        if (variantLabel) variantLabel.innerText = "ESTILOS DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Juguete disponible en Variedades Alejandro. Consulta modelos y existencias por WhatsApp.";
    } else if (currentActiveProd.categoria === 'hogar') {
        if (variantLabel) variantLabel.innerText = "DISEÑOS";
        if (modalDesc) modalDesc.innerText = "Artículo de hogar. Consulta modelos y existencias por WhatsApp";
    } else if (currentActiveProd.categoria === 'belleza') {
        if (variantLabel) variantLabel.innerText = "SERVICIOS";
        if (modalDesc) modalDesc.innerText = "Servicio disponible en Variedades Alejandro. Agenda tu cita, consulta por WhatsApp.";
    } else if (currentActiveProd.categoria === 'electro') {
        if (variantLabel) variantLabel.innerText = "DISEÑOS DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Electrodoméstico disponible en Variedades Alejandro. Consulta modelos y existencias por WhatsApp";
    } else if (currentActiveProd.categoria.includes('calzado')) {
        if (variantLabel) variantLabel.innerText = "TALLAS DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Calzado disponible en Variedades Alejandro. Más información por WhatsApp.";
    } else if (currentActiveProd.categoria === 'corporal') {
        if (variantLabel) variantLabel.innerText = "DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Producto disponible en Variedades Alejandro. Más información por WhatsApp.";
    } else {
        if (variantLabel) variantLabel.innerText = "TALLAS DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Articulo disponible en Variedades Alejandro. Más información por WhatsApp.";
    }

    // 6. Construcción limpia de las variantes sin arrastrar errores visuales
    const box = document.getElementById('sizeOptionsBox');
    if (box) {
        box.innerHTML = '';
        let variants = [];
        if (currentActiveProd.variante && currentActiveProd.variante.trim() !== '') {
            variants = currentActiveProd.variante.split(',').map(v => v.trim());
        } else {
            variants = ['Estándar'];
        }

        selectedSizeStr = variants[0];

        variants.forEach((v, i) => {
            const btn = document.createElement('button');
            btn.className = `size-btn ${i === 0 ? 'selected' : ''}`;
            btn.innerText = v;
            btn.type = "button";
            btn.onclick = () => {
                box.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedSizeStr = v;
            };
            box.appendChild(btn);
        });
    }

    const modalElement = document.getElementById('productModal');
    if (modalElement) modalElement.classList.add('active');
}

// Función del botón cerrar (✕)
function closeProductModal() {
    const modalElement = document.getElementById('productModal');
    if (modalElement) modalElement.classList.remove('active');
    currentActiveProd = null;
}

// Sumar/Restar cantidades numéricas
function updateQty(val) {
    if (!currentActiveProd) return;
    const stock = currentActiveProd.stock || 0;
    const newQty = qty + val;
    
    if (newQty < 1) return;
    if (currentActiveProd.categoria !== 'belleza' && newQty > stock) return;
    
    qty = newQty;
    const qtyValElement = document.getElementById('qtyVal');
    if (qtyValElement) qtyValElement.innerText = qty;
}

// El botón único del modal decide qué camino tomar
function handleModalAction() {
    if (!currentActiveProd) return;
    
    if (currentActiveProd.categoria === 'belleza') {
        sendDirectServiceToWhatsApp();
        closeProductModal();
    } else {
        addToCartCurrent();
    }
}

/* ==========================================================================
   5. LOGICA OPERATIVA DEL CARRITO DE COMPRAS LATERAL
   ========================================================================== */
function toggleCart(open) {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar && overlay) {
        if (open) {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        } else {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }
    }
}

function addToCartCurrent() {
    if (!currentActiveProd) return;

    // MURO DE SEGURIDAD ABSOLUTO: Si por error se ejecuta aquí, redirige e interrumpe
    if (currentActiveProd.categoria === 'belleza') {
        sendDirectServiceToWhatsApp();
        closeProductModal();
        return; 
    }

    const cartItemId = `${currentActiveProd.id}-${selectedSizeStr}`;
    const existingItem = cart.find(item => item.cartItemId === cartItemId);
    const stock = currentActiveProd.stock || 0;

    if (existingItem) {
        if (existingItem.qty + qty > stock) {
            existingItem.qty = stock; 
        } else {
            existingItem.qty += qty;
        }
    } else {
        cart.push({
            cartItemId: cartItemId,
            id: currentActiveProd.id,
            nombre: currentActiveProd.nombre,
            precio: Number(currentActiveProd.precio),
            imagen: currentActiveProd.imagen,
            talla: selectedSizeStr,
            categoria: currentActiveProd.categoria,
            qty: qty
        });
    }

    localStorage.setItem('alejandro_cart', JSON.stringify(cart));
    updateCartUI();
    closeProductModal();
    toggleCart(true); 
}

function removeFromCart(cartItemId) {
    cart = cart.filter(item => item.cartItemId !== cartItemId);
    localStorage.setItem('alejandro_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const listContainer = document.getElementById('cartItemsList');
    const totalContainer = document.getElementById('cartTotalVal');

    const totalItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
    if (badge) badge.innerText = totalItemsCount;

    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (cart.length === 0) {
        listContainer.innerHTML = `<p class="empty-cart-msg">Tu carrito está vacío.</p>`;
        if (totalContainer) totalContainer.innerText = '$0.00';
        return;
    }

    let subtotalGeneral = 0;

    cart.forEach(item => {
        const itemCost = item.precio * item.qty;
        subtotalGeneral += itemCost;

        const itemImg = item.imagen ? item.imagen : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 100 100" style="background:%23e2e8f0;"></svg>';
        
        let variantText = `Talla: ${item.talla}`;
        if (item.categoria === 'juguetes') variantText = `Estilo: ${item.talla}`;
        if (item.categoria === 'hogar' || item.categoria === 'electro') variantText = `Modelo: ${item.talla}`;

        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
            <img src="${itemImg}" alt="${item.nombre}" class="cart-item-img">
            <div class="cart-item-details">
                <span class="cart-item-name">${item.nombre}</span>
                <span class="cart-item-meta">${variantText} | Cant: ${item.qty}</span>
                <span class="cart-item-price">$${Number(itemCost).toFixed(2)}</span>
            </div>
            <button class="remove-item-btn" onclick="removeFromCart('${item.cartItemId}')">✕</button>
        `;
        listContainer.appendChild(row);
    });

    if (totalContainer) totalContainer.innerText = `$${subtotalGeneral.toFixed(2)}`;
}

/* ==========================================================================
   6. CANALES DE SALIDA FINAL (CONEXIÓN WHATSAPP)
   ========================================================================== */

// Caso A: Envío de Pedido Agrupado (Carrito Lateral)
function checkoutCartWhatsApp() {
    if (cart.length === 0) return;

    const phone = "50372215142"; 
    let msg = `🛒 *¡Hola Variedades Alejandro! Me interesa confirmar los siguiente articulos:* \n\n`;

    cart.forEach((item, index) => {
        let label = "Talla";
        if (item.categoria === 'juguetes') label = "Estilo";
        if (item.categoria === 'hogar' || item.categoria === 'electro') label = "Modelo";

        msg += `${index + 1}. *${item.nombre}*\n`;
        msg += `   • ${label}: ${item.talla}\n`;
        msg += `   • Cantidad: ${item.qty}\n`;
        msg += `   • Subtotal: $${(item.precio * item.qty).toFixed(2)}\n\n`;
    });

    const totalGeneral = cart.reduce((acc, item) => acc + (item.precio * item.qty), 0);
    msg += `💰 *Total Estimado:* $${totalGeneral.toFixed(2)}\n\n`;
    msg += `¿Podrían confirmarme la disponibilidad? ¡Muchas gracias!`;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Caso B: Consulta Instantánea Directa (Solo Salón de Belleza)
function sendDirectServiceToWhatsApp() {
    if (!currentActiveProd) return;
    const phone = "50372215142"; 
    
    let msg = `¡Hola! Me interesa reservar un servicio del Salón de Variedades Alejandro:\n\n` +
              `*Servicio:* ${currentActiveProd.nombre}\n` +
              `*Opción:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n\n` +
              `¡Podría brindarme más información para coordinar el día y la hora!`;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}
