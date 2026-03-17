// --- LÓGICA COMPARTIDA ---
const API_URL = "https://cripto-home.onrender.com/api/auth";

// 1. FUNCIÓN DE SEGURIDAD (Añádela al inicio de auth.js)
// Llama a esta función en cada página de dashboard para verificar permisos
function verificarAcceso(rolRequerido) {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");

    if (!token || !user) {
        window.location.href = "../auth/login.html";
        return;
    }

    if (rolRequerido && user.role !== rolRequerido) {
        alert("Acceso denegado: No tienes permisos suficientes.");
        // Redirigir según el rol real que tenga
        if (user.role === "admin") window.location.href = "../dashboard/ceo.html";
        else if (user.role === "support") window.location.href = "../dashboard/support.html";
        else window.location.href = "../dashboard/user.html";
    }
}

// --- SECCIÓN DE LOGIN ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("username").value; 
        const password = document.getElementById("password").value;
        
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));

                // REDIRECCIÓN SEGÚN ROL (CEO, Soporte o Usuario)
                switch(data.user.role) {
                    case "admin":
                        window.location.href = "../dashboard/ceo.html";
                        break;
                    case "support":
                        window.location.href = "../dashboard/support.html";
                        break;
                    default:
                        window.location.href = "../dashboard/user.html";
                }
            } else {
                alert(data.msg);
            }
        } catch (error) { console.error(error); }
    });
}

// --- SECCIÓN DE REGISTRO ---
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Extraer valores usando los IDs de tu HTML
        const username = document.getElementById("regUsername").value;
        const email = document.getElementById("regEmail").value;
        const password = document.getElementById("regPassword").value;
        const confirmPassword = document.getElementById("regConfirmPassword").value;
        const referralCode = document.getElementById("regInviteCode").value;
        const errorMsg = document.getElementById("regErrorMsg");

        // Limpiar mensaje de error previo
        if (errorMsg) errorMsg.innerText = "";

        // Validar contraseñas
        if (password !== confirmPassword) {
            if (errorMsg) errorMsg.innerText = "Las contraseñas no coinciden";
            return;
        }

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    username, 
                    email, 
                    password, 
                    referralCode: referralCode.trim() 
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert("✨ ¡Cuenta creada con éxito! Ahora inicia sesión.");
                window.location.href = "login.html";
            } else {
                // Mostrar el error directamente en el párrafo de error del HTML
                if (errorMsg) errorMsg.innerText = data.msg || "Error al registrar";
            }
        } catch (error) {
            console.error("Error:", error);
            if (errorMsg) errorMsg.innerText = "Error de conexión con el servidor";
        }
    });
}


// Llenar código de invitación desde la URL automáticamente
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    const inputInvite = document.getElementById('regInviteCode');
    if (ref && inputInvite) {
        inputInvite.value = ref;
    }
});