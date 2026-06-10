        /* --- ESTADO GLOBAL --- */
        let products = [];
        let selectedFile = null;
        let base64Preview = ""; 

        /* --- PROCESAMIENTO DE ARCHIVOS --- */
        function processFile(event) {
            selectedFile = event.target.files[0];
            if (!selectedFile) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                base64Preview = e.target.result;
                document.getElementById('img-preview').src = base64Preview;
                document.getElementById('preview-container').style.display = 'block';
            };
            reader.readAsDataURL(selectedFile);
        }

        /* --- ACCIONES API (SUPABASE) --- */
        async function saveProduct(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submit-btn');
            const editId = document.getElementById('edit-index').value;
            submitBtn.disabled = true;
            submitBtn.innerText = "Procesando...";
            
            let imageUrl = (editId !== "") ? products.find(p => p.id == editId).imagen : "";

            // Subir imagen si se seleccionó una nueva
            if (selectedFile) {
                const sanitizedName = selectedFile.name
                    .normalize("NFD")               // Descompone caracteres con acentos
                    .replace(/[\u0300-\u036f]/g, "") // Elimina tildes y diacríticos (incluye ñ)
                    .replace(/\s+/g, "")             // Elimina espacios
                    .replace(/[^a-zA-Z0-9._-]/g, ""); // Solo permite a-z, A-Z, 0-9, punto, guion y guion bajo
                const fileName = `${Date.now()}_${sanitizedName}`;
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('productos')
                    .upload(fileName, selectedFile);

                if (uploadError) {
                    alert("Error subiendo imagen: " + uploadError.message);
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Guardar Producto";
                    return;
                }
                const { data: urlData } = supabaseClient.storage.from('productos').getPublicUrl(fileName);
                imageUrl = urlData.publicUrl;
            }

            const productData = {
                    nombre: document.getElementById('formName').value.trim(),
                    precio: parseFloat(
                       document.getElementById('formPrice')
                            .value
                            .replace('$', '')
                            .trim()
            ),
                    categoria: document.getElementById('formCat').value,
                    stock: parseInt(document.getElementById('formStock').value) || 0,
                    variante: document.getElementById('formSizes').value.trim(),
                    imagen: imageUrl,
                    activo: true
            };

            let error;
            if (editId !== "") {
                const { error: updateError } = await supabaseClient
                    .from('productos')
                    .update(productData)
                    .eq('id', editId);
                error = updateError;
            } else {
                const { error: insertError } = await supabaseClient
                    .from('productos')
                    .insert([productData]);
                error = insertError;
            }

            if (error) {
                console.error("Error de Supabase al guardar producto:", error);
                alert("Error al guardar: " + error.message);
            } else {
                alert(editId ? "Producto actualizado!" : "Producto guardado!");
                resetForm();
                await fetchProducts();
                renderAdminList();
            }
            submitBtn.disabled = false;
        }

        async function fetchProducts() {
            const { data, error } = await supabaseClient
                .from('productos')
                .select('*')
                .order('id', { ascending: true });
            
            if (error) console.error("Error fetching:", error);
            else products = data;
        }

        /* --- GESTIÓN DEL FORMULARIO --- */
        function resetForm() {
            document.getElementById('productForm').reset();
            document.getElementById('edit-index').value = "";
            document.getElementById('form-title').innerText = "Añadir Producto";
            document.getElementById('submit-btn').innerText = "Guardar Producto";
            document.getElementById('formStock').value = 0;
            document.getElementById('cancel-edit').style.display = "none";
            document.getElementById('preview-container').style.display = "none";
            selectedFile = null;
            base64Preview = "";
        }

        function editProduct(id) {
            console.log("Iniciando edición de producto ID:", id);
            const p = products.find(prod => prod.id == id);
            if(!p) {
                console.error("No se encontró el producto localmente con ID:", id);
                return;
            }

            document.getElementById('edit-index').value = p.id;
            document.getElementById('formName').value = p.nombre;
            document.getElementById('formPrice').value = '$' + Number(p.precio).toFixed(2);
            document.getElementById('formCat').value = p.categoria;
            document.getElementById('formStock').value = p.stock || 0;
            document.getElementById('formSizes').value = p.variante;
            
            if (p.imagen) {
                document.getElementById('img-preview').src = p.imagen;
                document.getElementById('preview-container').style.display = 'block';
            }
            
            document.getElementById('form-title').innerText = "Editando: " + p.nombre;
            document.getElementById('submit-btn').innerText = "Actualizar Cambios";
            document.getElementById('cancel-edit').style.display = "block";
        }

        /* --- RENDERIZADO DE UI --- */
        function renderAdminList() {
            const list = document.getElementById('adminItemsList');
            const query = document.getElementById('adminSearch').value.toLowerCase();
            list.innerHTML = '';

            const filtered = products.filter(p => p.nombre.toLowerCase().includes(query));

            if (filtered.length === 0) {
                list.innerHTML = `<div class="empty-list-msg">No se encontraron productos.</div>`;
                return;
            }

            filtered.forEach((p, idx) => {
                const statusLabel = p.activo ? '🟢 Activo' : '⚫ Oculto';
                const toggleTitle = p.activo ? 'Ocultar' : 'Mostrar';
                const toggleIcon = p.activo ? '🚫' : '👁️';
                const toggleBg = p.activo ? '#64748b' : '#22c55e'; // Gris para ocultar, Verde para mostrar

                const row = document.createElement('div');
                row.className = 'inventory-item';
                row.style.animationDelay = `${idx * 0.05}s`;
                row.innerHTML = `
                    <img src="${p.imagen || 'https://via.placeholder.com/50'}" class="item-img">
                    <div class="item-info">
                        <span class="item-name">${p.nombre}</span>
                        <span class="item-price">$${Number(p.precio).toFixed(2)} <span class="item-status">Stock: ${p.stock || 0} | ${statusLabel}</span></span>
                    </div>
                    <div class="action-btns">
                        <button class="btn-icon" style="background: ${toggleBg}" onclick="toggleProductStatus(${p.id}, ${p.activo})" title="${toggleTitle}">${toggleIcon}</button>
                        <button class="btn-icon btn-edit" onclick="editProduct(${p.id})" title="Editar">✏️</button>
                        <button class="btn-icon btn-del" onclick="deleteProduct(${p.id})" title="Eliminar">🗑️</button>
                    </div>
                `;
                list.appendChild(row);
            });
        }

        async function toggleProductStatus(id, currentStatus) {
            const { error } = await supabaseClient
                .from('productos')
                .update({ activo: !currentStatus })
                .eq('id', id);

            if (error) {
                console.error("Error al cambiar visibilidad:", error);
                alert("Error al cambiar estado: " + error.message);
            } else {
                await fetchProducts();
                renderAdminList();
            }
        }

        async function deleteProduct(id) {
            console.log("Solicitando eliminación de producto ID:", id);
            if (confirm("¿Eliminar producto?")) {
                const { error } = await supabaseClient.from('productos').delete().eq('id', id);
                if (error) {
                    console.error("Error de Supabase al eliminar producto:", error);
                    alert("Error al eliminar: " + error.message);
                } else {
                    console.log("Producto eliminado correctamente de la base de datos.");
                    await fetchProducts();
                    renderAdminList();
                }
            }
        }

        // Cargar inventario automáticamente si hay una sesión válida
        if (document.getElementById('admin-panel')) {
            fetchProducts().then(() => renderAdminList());
        }