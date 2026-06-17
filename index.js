// Forzar el redireccionamiento al inicio absoluto al presionar F5 / Recargar
if (performance.navigation.type === 1 || window.performance.getEntriesByType("navigation")[0].type === "reload") {
    // Esto limpia la ruta actual y fuerza a cargar la raíz de la aplicación
    window.location.href = window.location.origin + window.location.pathname;
}

/* ==========================================================================
   1. ESTADO GLOBAL
   ========================================================================== */
let products = [];
let currentCategory = 'all';
let currentActiveProd = null;
let selectedSizeStr = "";
let qty = 1;

/* ==========================================================================
   2. EVENTOS DE CARGA E INICIALIZACIÓN
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
    window.location.hash = '#inicio';
    window.scrollTo(0, 0);
});

async function cargarProductos() {
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('id', { ascending: true });

    if (error) {
        console.error("Error cargando productos:", error);
    } else {
        products = data;
        renderStore();
    }
}

// Sincronización en tiempo real
supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => {
        cargarProductos();
    }).subscribe();

cargarProductos();

/* ==========================================================================
   3. FUNCIONES DEL CATÁLOGO (RENDER, FILTROS, BÚSQUEDA)
   ========================================================================== */
function renderStore() {
    const grid = document.getElementById('storeGrid');
    grid.innerHTML = '';

    let filtered = products;

    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.categoria === currentCategory);
    }

    const query = document.getElementById('searchBar').value.trim().toLowerCase();
    if (query !== '') {
        filtered = filtered.filter(p => p.nombre.toLowerCase().includes(query));
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="store-empty-msg">No se encontraron artículos en esta sección.</p>`;
        return;
    }

    filtered.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Si no hay imagen válida, se genera un recuadro de color amigable automáticamente
        const itemImg = p.imagen ? p.imagen : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="background:%23e2e8f0;"><text x="50%" y="55%" font-family="sans-serif" font-size="10" fill="%2364748b" text-anchor="middle">Sin Foto</text></svg>';

        // Cambiar texto dinámicamente y mantenerlo limpio (sin emojis)
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
                <button class="order-btn" onclick="openProductModal(${products.indexOf(p)})">
                    ${btnText}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`[data-cat="${cat}"]`).classList.add('active');
    renderStore();
}

function searchProducts() {
    renderStore();
}

/* ==========================================================================
   4. MODAL DE PRODUCTO (DETALLES Y CANTIDADES)
   ========================================================================== */
function openProductModal(index) {
    currentActiveProd = products[index];
    qty = 1;
    document.getElementById('qtyVal').innerText = qty;

    document.getElementById('modalTitle').innerText = currentActiveProd.nombre;
    document.getElementById('modalPrice').innerText = '$' + Number(currentActiveProd.precio).toFixed(2);
    
    const modalImg = document.getElementById('modalImg');
    modalImg.src = currentActiveProd.imagen ? currentActiveProd.imagen : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="background:%23e2e8f0;"><text x="50%" y="55%" font-family="sans-serif" font-size="10" fill="%2364748b" text-anchor="middle">Sin Foto</text></svg>';

    // Sistema de Stock
    const stock = currentActiveProd.stock || 0;
    let stockDisplay = document.getElementById('modalStock');
    if (!stockDisplay) {
        stockDisplay = document.createElement('p');
        stockDisplay.id = 'modalStock';
        stockDisplay.className = 'modal-stock-info';
        document.getElementById('modalPrice').insertAdjacentElement('afterend', stockDisplay);
    }

    const wpBtn = document.querySelector('.send-wp-final');
    const qtyArea = document.getElementById('qtyArea');

    if (currentActiveProd.categoria === 'belleza') {
        stockDisplay.style.display = 'none';
        wpBtn.disabled = false;
        wpBtn.querySelector('span').innerText = "Consultar por WhatsApp →";
    } else {
        stockDisplay.style.display = 'block';
        if (stock > 0) {
            stockDisplay.innerHTML = `Disponibles: ${stock}`;
            wpBtn.disabled = false;
            wpBtn.querySelector('span').innerText = "Reservar por WhatsApp →";
        } else {
            stockDisplay.innerHTML = `<span class="stock-out">❌ AGOTADO</span>`;
            wpBtn.disabled = true;
            wpBtn.querySelector('span').innerText = "Agotado";
        }
    }

    // Cambios de textos dinámicos exactos para las dos columnas
    const modalDesc = document.querySelector('.modal-product-desc');

    if (currentActiveProd.categoria === 'belleza') {
        document.getElementById('variantLabel').innerText = "PROGRAMAR CITA";
        document.getElementById('qtyArea').style.display = 'none';
        modalDesc.innerText = "Servicio disponible en Variedades Alejandro. Agenda tu cita, consulta por WhatsApp.";
    } else if (currentActiveProd.categoria === 'electro') {
        if (stock <= 0) {
            document.getElementById('qtyArea').style.display = 'none';
        } else {
            document.getElementById('qtyArea').style.display = 'flex';
        }
        document.getElementById('variantLabel').innerText = "DISEÑOS DISPONIBLES";
        modalDesc.innerText = "Electrodoméstico disponible en Variedades Alejandro. Consulta disponibilidad y detalles por WhatsApp.";
    } else if (currentActiveProd.categoria.includes('calzado')) {
        if (stock <= 0) {
            document.getElementById('qtyArea').style.display = 'none';
        } else {
            document.getElementById('qtyArea').style.display = 'flex';
        }
        document.getElementById('variantLabel').innerText = "TALLAS DISPONIBLES";
        modalDesc.innerText = "Calzado disponible en Variedades Alejandro. Consulta tallas y disponibilidad por WhatsApp.";
    } else if (currentActiveProd.categoria === 'corporal') {
        if (stock <= 0) {
            document.getElementById('qtyArea').style.display = 'none';
        } else {
            document.getElementById('qtyArea').style.display = 'flex';
        }
        document.getElementById('variantLabel').innerText = "TONOS DISPONIBLES";
        modalDesc.innerText = "Producto corporal disponible en Variedades Alejandro. Consulta tonos y disponibilidad por WhatsApp.";
    } else {
        if (stock <= 0) {
            document.getElementById('qtyArea').style.display = 'none';
        } else {
            document.getElementById('qtyArea').style.display = 'flex';
        }
        document.getElementById('variantLabel').innerText = "TALLAS DISPONIBLES";
        modalDesc.innerText = "Artículo disponible en Variedades Alejandro. Haz tu consulta directa por WhatsApp.";
    }

    const box = document.getElementById('sizeOptionsBox');
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
        btn.onclick = () => {
            const siblingButtons = box.querySelectorAll('.size-btn');
            siblingButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedSizeStr = v;
        };
        box.appendChild(btn);
    });

    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

function updateQty(val) {
    const stock = currentActiveProd.stock || 0;
    const newQty = qty + val;
    if (newQty < 1) return;
    if (newQty > stock) return;
    qty = newQty;
    document.getElementById('qtyVal').innerText = qty;
}

/* ==========================================================================
   5. ACCIONES EXTERNAS (NATIVA DE WHATSAPP SIN PARPADEO)
   ========================================================================== */
function sendToWhatsApp() {
    const phone = "50375037418"; // Tu número de WhatsApp registrado
    let msg = "";

    if (currentActiveProd.categoria === 'belleza') {
        msg = `¡Hola! Me interesa agendar una cita en Variedades Alejandro:\n\n` +
              `*Servicio:* ${currentActiveProd.nombre}\n` +
              `*Tipo:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n\n` +
              `¡Podrían brindarme más información!`;
    } else if (currentActiveProd.categoria === 'electro') {
        msg = `¡Hola! Estoy interesado en este electrodoméstico:\n\n` +
              `*Producto:* ${currentActiveProd.nombre}\n` +
              `*Diseño:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podrían brindarme más información!`;
    } else if (currentActiveProd.categoria === 'corporal') {
        msg = `¡Hola! Me interesa este producto de cuidado personal:\n\n` +
              `*Producto:* ${currentActiveProd.nombre}\n` +
              `*Tono:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podrían brindarme más información!`;
    } else if (currentActiveProd.categoria.includes('calzado')) { 
        msg = `¡Hola! Me interesa este calzado:\n\n` +
              `*Producto:* ${currentActiveProd.nombre}\n` +
              `*Talla:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podrían brindarme más información!`;
    } else {
        msg = `¡Hola! Me interesa este artículo:\n\n` +
              `*Producto:* ${currentActiveProd.nombre}\n` +
              `*Talla:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podrían brindarme más información!`;
    }

    // Al usar api.whatsapp con target _blank el navegador delega de inmediato el control al OS móvil
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}
