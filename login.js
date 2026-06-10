document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button');

    submitBtn.disabled = true;
    submitBtn.innerText = "Verificando...";

    // Intento de inicio de sesión con Supabase Auth
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Error de acceso: " + error.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "Iniciar Sesión";
    } else {
        window.location.href = "admin.html";
    }
});