async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = "login.html";
        }
    } else {
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            adminPanel.style.display = 'block';
        }
    }
}

checkSession();

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}