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
async function cargarProductos() {
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true); 

    if (error) {
        console.error("Error cargando productos:", error);
    } else {
        // Mezcla el array de productos de forma aleatoria
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

// Carga inicial segura
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
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

        // CORRECCIÓN CRÍTICA: Ahora mandamos el ID único del producto de la base de datos (p.id) 
        // en lugar de su índice index, evitando que se abra el producto equivocado al buscar o filtrar.
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
    document.querySelectorAll('.cat-card').forEach(card => {
        card.classList.remove('active');
    });
    const targetCard = document.querySelector(`[data-cat="${cat}"]`);
    if (targetCard) targetCard.classList.add('active');
    renderStore();
}

function searchProducts() {
    renderStore();
}

/* ==========================================================================
   4. MODAL DE PRODUCTO (DETALLES Y CANTIDADES)
   ========================================================================== */
function openProductModal(prodId) {
    // Busca el producto exacto por su ID dentro del array global
    currentActiveProd = products.find(p => String(p.id) === String(prodId));
    if (!currentActiveProd) return;

    qty = 1;
    document.getElementById('qtyVal').innerText = qty;

    document.getElementById('modalTitle').innerText = currentActiveProd.nombre;
    document.getElementById('modalPrice').innerText = '$' + Number(currentActiveProd.precio).toFixed(2);
    
    const modalImg = document.getElementById('modalImg');
    if (modalImg) {
        modalImg.src = currentActiveProd.imagen ? currentActiveProd.imagen : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="background:%23e2e8f0;"><text x="50%" y="55%" font-family="sans-serif" font-size="10" fill="%2364748b" text-anchor="middle">Sin Foto</text></svg>';
    }

    // Sistema de Stock
    const stock = currentActiveProd.stock || 0;
    let stockDisplay = document.getElementById('modalStock');
    if (!stockDisplay) {
        stockDisplay = document.createElement('p');
        stockDisplay.id = 'modalStock';
        stockDisplay.className = 'modal-stock-info';
        const priceLabel = document.getElementById('modalPrice');
        if (priceLabel) priceLabel.insertAdjacentElement('afterend', stockDisplay);
    }

    const wpBtn = document.querySelector('.send-wp-final');
    const qtyArea = document.getElementById('qtyArea');

    if (currentActiveProd.categoria === 'belleza') {
        if (stockDisplay) stockDisplay.style.display = 'none';
        if (wpBtn) {
            wpBtn.disabled = false;
            wpBtn.querySelector('span').innerText = "Consultar por WhatsApp →";
        }
    } else {
        if (stockDisplay) stockDisplay.style.display = 'block';
        if (stock > 0) {
            if (stockDisplay) stockDisplay.innerHTML = `Disponibles: ${stock}`;
            if (wpBtn) {
                wpBtn.disabled = false;
                wpBtn.querySelector('span').innerText = "Reservar por WhatsApp →";
            }
        } else {
            if (stockDisplay) stockDisplay.innerHTML = `<span class="stock-out">❌ AGOTADO</span>`;
            if (wpBtn) {
                wpBtn.disabled = true;
                wpBtn.querySelector('span').innerText = "Agotado";
            }
        }
    }

    // Cambios de textos dinámicos exactos para las dos columnas
    const modalDesc = document.querySelector('.modal-product-desc');
    const variantLabel = document.getElementById('variantLabel');

    if (currentActiveProd.categoria === 'belleza') {
        if (variantLabel) variantLabel.innerText = "PROGRAMAR CITA";
        if (qtyArea) qtyArea.style.display = 'none';
        if (modalDesc) modalDesc.innerText = "Servicio disponible en Variedades Alejandro. Agenda tu cita, consulta por WhatsApp.";
    } else if (currentActiveProd.categoria === 'electro') {
        if (qtyArea) qtyArea.style.display = stock <= 0 ? 'none' : 'flex';
        if (variantLabel) variantLabel.innerText = "DISEÑOS DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Electrodoméstico disponible en Variedades Alejandro. Consulta disponibilidad y detalles por WhatsApp.";
    } else if (currentActiveProd.categoria.includes('calzado')) {
        if (qtyArea) qtyArea.style.display = stock <= 0 ? 'none' : 'flex';
        if (variantLabel) variantLabel.innerText = "TALLAS DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Calzado disponible en Variedades Alejandro. Consulta tallas y disponibilidad por WhatsApp.";
    } else if (currentActiveProd.categoria === 'corporal') {
        if (qtyArea) qtyArea.style.display = stock <= 0 ? 'none' : 'flex';
        if (variantLabel) variantLabel.innerText = "DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Producto disponible en Variedades Alejandro. Consulta tonos y disponibilidad por WhatsApp.";
    } else {
        if (qtyArea) qtyArea.style.display = stock <= 0 ? 'none' : 'flex';
        if (variantLabel) variantLabel.innerText = "TALLAS DISPONIBLES";
        if (modalDesc) modalDesc.innerText = "Artículo disponible en Variedades Alejandro. Haz tu consulta directa por WhatsApp.";
    }

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
            btn.onclick = () => {
                const siblingButtons = box.querySelectorAll('.size-btn');
                siblingButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedSizeStr = v;
            };
            box.appendChild(btn);
        });
    }

    const modalElement = document.getElementById('productModal');
    if (modalElement) modalElement.classList.add('active');
}

function closeProductModal() {
    const modalElement = document.getElementById('productModal');
    if (modalElement) modalElement.classList.remove('active');
}

function updateQty(val) {
    if (!currentActiveProd) return;
    const stock = currentActiveProd.stock || 0;
    const newQty = qty + val;
    if (newQty < 1) return;
    if (newQty > stock) return;
    qty = newQty;
    const qtyValElement = document.getElementById('qtyVal');
    if (qtyValElement) qtyValElement.innerText = qty;
}

/* ==========================================================================
   5. ACCIONES EXTERNAS (NATIVA DE WHATSAPP SIN PARPADEO)
   ========================================================================== */
function sendToWhatsApp() {
    if (!currentActiveProd) return;
    const phone = "50375037418"; 
    let msg = "";

    // 1. ROPA MUJER (Talla)
    if (currentActiveProd.categoria === 'mujer-ropa') {
        msg = `¡Hola! Me interesa esta prenda para dama en Variedades Alejandro:\n\n` +
              `*Prenda:* ${currentActiveProd.nombre}\n` +
              `*Talla:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;

    // 2. ROPA HOMBRE (Talla)
    } else if (currentActiveProd.categoria === 'hombre-ropa') {
        msg = `¡Hola! Me interesa esta prenda para caballero en Variedades Alejandro:\n\n` +
              `*Prenda:* ${currentActiveProd.nombre}\n` +
              `*Talla:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;

    // 3. CALZADO (Talla de zapato)
    } else if (currentActiveProd.categoria === 'mujer-calzado') {
        msg = `¡Hola! Me interesa este calzado en Variedades Alejandro:\n\n` +
              `*Estilo:* ${currentActiveProd.nombre}\n` +
              `*Talla:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;

    // 4. ROPA NIÑOS (Talla / Edad)
    } else if (currentActiveProd.categoria === 'ninos-ropa') {
        msg = `¡Hola! Me interesa esta prenda infantil en Variedades Alejandro:\n\n` +
              `*Artículo:* ${currentActiveProd.nombre}\n` +
              `*Talla/Edad:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;

    // 5. JUGUETES (Estilo o Personaje)
    } else if (currentActiveProd.categoria === 'ninos-calzado') { 
        msg = `¡Hola! Me interesa este juguete en Variedades Alejandro:\n\n` +
              `*Juguete:* ${currentActiveProd.nombre}\n` +
              `*Estilo/Variante:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;

    // 6. HOGAR Y COMODIDADES (Diseño o Modelo)
    } else if (currentActiveProd.categoria === 'hombre-calzado') {
        msg = `¡Hola! Me interesa este artículo para el hogar en Variedades Alejandro:\n\n` +
              `*Producto:* ${currentActiveProd.nombre}\n` +
              `*Modelo/Diseño:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;

    // 7. PRODUCTOS DE BELLEZA (Tono, Color o Tipo)
    } else if (currentActiveProd.categoria === 'corporal') {
        msg = `¡Hola! Me interesa este producto cosmético/belleza en Variedades Alejandro:\n\n` +
              `*Producto:* ${currentActiveProd.nombre}\n` +
              `*Tono/Variante:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;

    // 8. SALÓN DE BELLEZA (Citas / Servicios)
    } else if (currentActiveProd.categoria === 'belleza') {
        msg = `¡Hola! Me interesa reservar o consultar un servicio del Salón de Variedades Alejandro:\n\n` +
              `*Servicio:* ${currentActiveProd.nombre}\n` +
              `*Opción:* ${selectedSizeStr}\n` +
              `*Precio desde:* $${Number(currentActiveProd.precio).toFixed(2)}\n\n` +
              `¡Podría brindarme más información!`;

    // 9. ELECTRODOMÉSTICOS (Modelo / Capacidad)
    } else if (currentActiveProd.categoria === 'electro') {
        msg = `¡Hola! Estoy interesado en este electrodoméstico de Variedades Alejandro:\n\n` +
              `*Aparato:* ${currentActiveProd.nombre}\n` +
              `*Capacidad/Diseño:* ${selectedSizeStr}\n` +
              `*Precio:* $${Number(currentActiveProd.precio).toFixed(2)}\n` +
              `*Cantidad:* ${qty}\n\n` +
              `¡Podría brindarme más información!`;
    } 

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}
