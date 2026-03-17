// Configuración
const API_URL_AUTH = "https://cripto-home.onrender.com/api/auth";
const token = localStorage.getItem("token");

// Verificar si hay token, si no, patitas para la calle
if (!token) {
    window.location.href = "../auth/login.html";
}

async function buscarUsuarioSoporte() {
    const query = document.getElementById('search-user-support').value;
    if (!query) return alert("Ingresa email o ID para buscar");

    try {
        // IMPORTANTE: Ajusté la URL a la de tu API de admin
        const res = await fetch(`https://cripto-home.onrender.com/api/admin/user-detail/${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const err = await res.json();
            return alert(err.message || "Usuario no encontrado");
        }

        const data = await res.json();
        const { user, deposits, withdrawals, referralCount } = data;

        const panel = document.getElementById('panel-soporte-resultado');
        panel.style.display = 'block';

        const isSuspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
        const fechaFin = isSuspended ? new Date(user.suspendedUntil).toLocaleDateString() : '';

        panel.innerHTML = `
            <div style="background: #1a3a5a; padding: 15px; border-radius: 10px 10px 0 0; display: flex; justify-content: space-between;">
                <h3 style="margin:0; color: #f4a261;">🎧 Soporte: ${user.username}</h3>
                <button onclick="document.getElementById('panel-soporte-resultado').style.display='none'" style="background:none; border:none; color:white; cursor:pointer; font-size:1.2rem;">✖</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 15px; background: #0d1a29;">
                <div style="background:#12263a; padding:10px; border-radius:8px; text-align:center;">
                    <small style="color:gray;">Saldo Disponible</small>
                    <div style="color:#2ecc71; font-weight:bold;">$${user.balanceAvailable.toFixed(2)}</div>
                </div>
                <div style="background:#12263a; padding:10px; border-radius:8px; text-align:center;">
                    <small style="color:gray;">Estado</small>
                    <div style="font-weight:bold; color: ${user.isBlocked ? '#e74c3c' : (isSuspended ? '#f1c40f' : '#2ecc71')}">
                        ${user.isBlocked ? '🛑 BANEADO' : (isSuspended ? '⏳ SUSP. hasta ' + fechaFin : '✅ ACTIVO')}
                    </div>
                </div>
            </div>

            <div style="padding: 15px; display: flex; flex-direction: column; gap: 8px; background: #0d1a29;">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button onclick="resetPasswordSoporte('${user._id}')" style="padding:10px; background:#444; color:white; border:none; border-radius:5px; cursor:pointer; font-size:0.8rem;">🔑 Password</button>
                    <button onclick="suspenderUsuario('${user._id}')" style="padding:10px; background:#f39c12; color:white; border:none; border-radius:5px; cursor:pointer; font-size:0.8rem;">⏳ Suspender</button>
                </div>

                <button onclick="toggleBaneo('${user._id}')" style="padding:12px; background:${user.isBlocked ? '#2ecc71' : '#e74c3c'}; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">
                    ${user.isBlocked ? '🔓 Desbloquear Usuario' : '🚫 Banear Usuario'}
                </button>
            </div>

            <div style="padding: 15px; background: #08121d;">
                <h4 style="font-size:0.8rem; color:#f4a261; margin-bottom:10px;">🕒 Historial Reciente</h4>
                <div id="historial-soporte-lista">
                    ${generarFilasSoporte(deposits, withdrawals)}
                </div>
            </div>
        `;
    } catch (e) {
        console.error(e);
        alert("Error al conectar con el servidor de soporte");
    }
}

function generarFilasSoporte(deposits, withdrawals) {
    const todos = [
        ...deposits.map(d => ({ t: 'DEP', a: d.amountUSD, f: d.createdAt, s: d.status })),
        ...withdrawals.map(w => ({ t: 'RET', a: w.amount, f: w.createdAt, s: w.status }))
    ].sort((a, b) => new Date(b.f) - new Date(a.f)).slice(0, 5);

    if (todos.length === 0) return '<p style="font-size:0.7rem; text-align:center;">Sin movimientos</p>';

    return todos.map(m => `
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; border-bottom:1px solid #222; padding:5px 0;">
            <span>${m.t}</span>
            <span style="color:${m.t === 'DEP' ? '#2ecc71' : '#e74c3c'}">$${m.a.toFixed(2)}</span>
            <span>${m.s}</span>
        </div>
    `).join('');
}

// Implementación de Reset para Soporte
async function resetPasswordSoporte(userId) {
    const newPass = prompt("Nueva contraseña:");
    if (!newPass) return;
    try {
        const res = await fetch(`https://cripto-home.onrender.com/api/admin/update-user-pass`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userId, newPass })
        });
        alert("Contraseña actualizada con éxito");
    } catch (e) { alert("Error al cambiar clave"); }
}

// 2. BANEAR / DESBLOQUEAR
async function toggleBaneo(userId) {
    if (!confirm("¿Deseas cambiar el estado de bloqueo (Ban) de este usuario?")) return;

    try {
        const res = await fetch(`https://cripto-home.onrender.com/api/admin/toggle-block`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ userId })
        });

        const data = await res.json();
        alert(data.message);
        // Recargar los datos para ver el cambio
        buscarUsuarioSoporte(); 
    } catch (e) {
        alert("Error al procesar el baneo");
    }
}

// 3. SUSPENDER POR DÍAS
async function suspenderUsuario(userId) {
    const dias = prompt("¿Cuántos días quieres suspender al usuario? (Ejemplo: 3)");
    if (!dias || isNaN(dias)) return alert("Ingresa un número de días válido.");

    try {
        const res = await fetch(`https://cripto-home.onrender.com/api/admin/suspend-user`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ userId, dias })
        });

        const data = await res.json();
        alert(data.message);
    } catch (e) {
        alert("Error al suspender");
    }
}