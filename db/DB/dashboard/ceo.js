const API_URL = 'https://cripto-home.onrender.com/api';
const token = localStorage.getItem('token');

// Al cargar el documento, inicializamos todo
document.addEventListener('DOMContentLoaded', () => {
    if (!token) return window.location.href = "../auth/login.html";
    listarRedesAdmin(); // Carga la sección de redes
    cargarStats();           // Carga los números grandes de arriba
    cargarDepositos();       // Carga la tabla de depósitos
    cargarRetirosAdmin();    // Carga la tabla de retiros
    cargarAuditoriaGlobal();
    sumaRetiros = 0; // Inicializamos la variable global para sumar retiros
    sumaDepositos = 0; // Inicializamos la variable global para sumar depósitos
    // Configurar búsqueda
    const searchBtn = document.querySelector('.search-box button');
    if (searchBtn) searchBtn.onclick = buscarUsuario;
});

// 0. CARGAR ESTADÍSTICAS (Stats reales desde el servidor)
async function cargarStats() {
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await res.json();
        document.getElementById('stat-users').innerText = stats.totalUsers || 0;
        document.getElementById('stat-deposits').innerText = `$${stats.totalDeposits || 0}`;
        document.getElementById('stat-withdrawals').innerText = `$${stats.totalWithdrawals || 0}`;
    } catch (e) {
        console.error("Error al cargar estadísticas:", e);
    }
}

// 1. CARGAR DEPÓSITOS PENDIENTES
async function cargarDepositos() {
    try {
        const res = await fetch(`${API_URL}/admin/deposits/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const deposits = await res.json();
        const container = document.getElementById('lista-depositos-pendientes');

        if (!container) return;

       container.innerHTML = deposits.map(d => {
    // 1. Recortamos el TXID
    const txidCorto = d.txid ? `${d.txid.substring(0, 6)}...${d.txid.substring(d.txid.length - 4)}` : 'S/N';
    
    // 2. SOLUCIÓN AL [object Object]:
    // Si d.network es un objeto, usamos d.network.network (o .name). 
    // Si es un string, lo usamos directo.
    let nombreRed = "USDT";
    if (d.network) {
        if (typeof d.network === 'object') {
            // Ajusta '.network' por '.name' según lo que devuelva tu backend poblado
            nombreRed = d.network.network || d.network.name || "S/N";
        } else {
            nombreRed = d.network; // Es un string como "BEP20"
        }
    }

    return `
        <div class="row">
            <span>${d.user ? d.user.username : '---'}</span>
            <span style="font-weight:bold; color:#2ecc71;">$${d.amountUSD}</span>
            <span style="font-size:0.8rem;">${nombreRed}</span>
            <span style="font-family: monospace; font-size:0.75rem;">
                ${txidCorto}
                <button class="copy-btn" onclick="copiarTexto('${d.txid}')">📋</button>
            </span>
            <div class="acciones-admin">
                <button class="btn-approve-mini" onclick="procesarAprobacion('${d._id}')">✅</button>
                <button class="btn-reject-mini" onclick="rechazarDeposito('${d._id}')">❌</button>
            </div>
        </div>
    `;
}).join('') || '<p style="padding:15px; text-align:center; color:#888;">No hay depósitos pendientes</p>';
    } catch (e) { 
        console.error("Error cargando depósitos:", e); 
    }
}

// 2. APROBAR DEPÓSITO
async function procesarAprobacion(id) {
    const amountUSD = prompt("Ingresa el monto exacto en USD a acreditar:");
    if (!amountUSD || isNaN(amountUSD)) return;

    try {
        const res = await fetch(`${API_URL}/admin/deposits/approve/${id}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ amountUSD: Number(amountUSD) })
        });

        const data = await res.json();
        alert(data.message);
        if (res.ok) {
            cargarDepositos();
            cargarStats();
        }
    } catch (error) {
        alert("Error al aprobar.");
    }
}

// 2. RECHAZAR DEPÓSITO
async function rechazarDeposito(id) {
    if (!confirm("¿Rechazar este depósito?")) return;
    try {
        const res = await fetch(`${API_URL}/admin/deposits/reject/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            alert("Depósito rechazado");
            cargarDepositos();       // Refresca la lista de pendientes
            cargarAuditoriaGlobal(); // 👈 ESTA es la que te refresca el historial abajo
        }
    } catch (e) { alert("Error al rechazar"); }
}

// 3. CARGAR RETIROS
async function cargarRetirosAdmin() {
    const container = document.getElementById('lista-retiros-pendientes');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/admin/withdrawals/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const retiros = await res.json();

        if (retiros.length === 0) {
            container.innerHTML = '<p style="padding: 20px;">No hay retiros pendientes ✨</p>';
            return;
        }

        container.innerHTML = retiros.map(r => `
            <div class="row">
                <span data-label="Usuario">${r.userId ? r.userId.username : '---'}</span>
                <span data-label="Monto" style="color: #ff4d4d;">$${Math.abs(r.amount).toFixed(2)}</span>
                <span data-label="Red">${r.network}</span>
                <span data-label="Billetera" class="txid-cell">${r.address}</span>
                <div class="actions">
                    <button onclick="aprobarRetiro('${r._id}')" class="btn-approve">Aprobar</button>
                    <button onclick="abrirModalRechazo('${r._id}')" class="btn-reject">Rechazar</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p>Error al cargar retiros.</p>';
    }
}

// 4. APROBAR RETIRO
async function aprobarRetiro(id) {
    if(!confirm("¿Confirmas que el pago fue enviado manualmente?")) return;
    
    try {
        const res = await fetch(`${API_URL}/admin/withdrawals/approve/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
            alert("Retiro marcado como pagado.");
            cargarRetirosAdmin();
            cargarStats();
        }
    } catch (e) { alert("Error en el servidor."); }
}

// 5. AJUSTE MANUAL
async function enviarAjuste(tipoAccion) {
    const identifier = document.getElementById('adj-identifier').value.trim(); // Limpiamos espacios
    const amount = document.getElementById('adj-amount').value;
    const title = document.getElementById('adj-title')?.value || "Ajuste de Saldo";
    const description = document.getElementById('adj-description').value;

    if (!identifier || !amount || !description) return alert("Completa los campos");

    // Para debugear en vivo si es necesario
    console.log("Enviando ajuste a:", identifier, "Tipo:", tipoAccion);

    try {
        const res = await fetch(`${API_URL}/admin/adjust-balance`, { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                identifier, // Este ahora será el _id largo de Mongo
                amount: Number(amount),
                action: tipoAccion,
                title,
                description
            })
        });

        const data = await res.json();
        
        if (res.ok) {
            alert("✅ " + data.message);
            cerrarModal();
            cargarStats();
            // Si el expediente está abierto, podrías refrescarlo aquí
        } else {
            alert("❌ Error: " + data.message);
        }
    } catch (error) { 
        alert("Error de conexión al servidor."); 
    }
}

let usuarioSeleccionadoID = "";

// 6. BUSQUEDA - EL EXPEDIENTE X (RECARGADO)
async function buscarUsuarioProfundo() {
    usuarioSeleccionadoID = "";
    const query = document.getElementById('search-user').value;
    if (!query) return alert("Ingresa un dato para buscar");

    try {
        const res = await fetch(`${API_URL}/admin/user-detail/${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const err = await res.json();
            return alert(err.message || "Usuario no encontrado");
        }

        const data = await res.json();
        // Extraemos referralCount que viene del backend
        const { user, deposits, withdrawals, vips, referralCount } = data;

        const expediente = document.getElementById('seccion-expediente');
        expediente.style.display = 'block';

        // Lógica para determinar si el usuario está suspendido actualmente
        const isSuspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
        const fechaFin = isSuspended ? new Date(user.suspendedUntil).toLocaleDateString() : '';

        expediente.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; background: #1a3a5a; padding: 15px; border-radius: 10px 10px 0 0;">
                <h2 style="color: #f4a261; margin:0;">📁 Expediente: ${user.username}</h2>
                <button onclick="cerrarExpediente()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.5rem;">✖</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 15px; background: #0d1a29;">
                <button class="btn-approve" style="padding: 15px; font-weight: bold;" onclick="abrirModalAjuste('${user._id}')">💰 Ajustar Saldo</button>
                <button class="menu-btn" style="padding: 15px; font-weight: bold; background: #3498db;" onclick="loguearComoUsuario('${user.email}')">👁️ Controlar</button>
            </div>

            <div class="stats" style="padding:15px; margin-bottom:0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                <div class="stat-card" style="background:#12263a; padding: 10px;">
                    <p style="font-size:0.6rem;">Disponible</p>
                    <h3 style="color:#2ecc71; font-size:0.9rem;">$${user.balanceAvailable.toFixed(2)}</h3>
                </div>
                <div class="stat-card" style="background:#12263a; padding: 10px;">
                    <p style="font-size:0.6rem;">Inversión</p>
                    <h3 style="color:#e74c3c; font-size:0.9rem;">$${user.balanceFrozen.toFixed(2)}</h3>
                </div>
                <div class="stat-card" style="background:#12263a; padding: 10px;">
                    <p style="font-size:0.6rem;">Comisiones</p>
                    <h3 style="font-size:0.9rem;">$${(user.totalCommissions || 0).toFixed(2)}</h3>
                </div>
                <div class="stat-card" style="background:#1a3a5a; padding: 10px; border: 1px solid #f4a261;">
                    <p style="font-size:0.6rem; color:#f4a261;">Invitados</p>
                    <h3 style="font-size:1.1rem; color:white;">${referralCount || 0}</h3>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 15px; font-size: 0.85rem;">
                <div style="background:#12263a; padding:12px; border-radius:8px;">
                    <p><strong>Email:</strong><br>${user.email}</p>
                    <p><strong>Código:</strong> ${user.referralCode}</p>
                </div>
                <div style="background:#12263a; padding:12px; border-radius:8px;">
                    <p><strong>Estado:</strong><br>
                        ${user.isBlocked ? '<span style="color:#e74c3c; font-weight:bold;">🛑 BANEADO</span>' : 
                          isSuspended ? `<span style="color:#f39c12; font-weight:bold;">⏳ SUSPENDIDO (Hasta ${fechaFin})</span>` : 
                          '<span style="color:#2ecc71; font-weight:bold;">✅ ACTIVO</span>'}
                    </p>
                    <p><strong>Rol:</strong> <span class="role">${user.role}</span></p>
                </div>
            </div>

            <div style="padding: 0 15px 15px; display: flex; flex-direction: column; gap: 8px;">
                <button class="btn-reject" style="width:100%;" onclick="toggleBloqueo('${user._id}')">
                    ${user.isBlocked ? '🔓 Desbloquear Cuenta' : '🚫 Banear Usuario'}
                </button>
                <button style="width:100%; padding: 10px; background: #f39c12; border:none; color:white; border-radius:5px; cursor:pointer; font-weight:bold;" onclick="suspenderUsuario('${user._id}')">
                    ⏳ Suspender Temporalmente
                </button>
                <button class="copy-btn" style="width:100%; background: #444;" onclick="resetPassword('${user._id}')">🔑 Resetear Contraseña</button>
            </div>

            <div style="padding: 15px; background: #08121d;">
                <h3 style="font-size:1rem; color:#f4a261; margin-bottom:10px;">🕒 Últimos Movimientos</h3>
                <div class="table">
                    ${generarFilasHistorial(deposits, withdrawals)}
                </div>
            </div>
        `;
    } catch (e) {
        alert("Error al cargar el expediente");
    }
}

// Función para "Saltar" a la cuenta del usuario
function loguearComoUsuario(email) {
    if(confirm("Vas a entrar al panel de " + email + ". ¿Continuar?")) {
        // Guardamos el email del usuario para que el dashboard sepa a quién mostrar
        localStorage.setItem('admin_view_user', email);
        window.location.href = "../dashboard/user.html"; 
    }
}

// 1. RESETEAR CONTRASEÑA
async function resetPassword(userId) {
    const newPass = prompt("Escribe la nueva contraseña para este usuario:");
    if (!newPass) return;
    
    if (!confirm("¿Estás seguro de cambiar la contraseña?")) return;

    try {
        const res = await fetch(`${API_URL}/admin/update-user-pass`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userId, newPass })
        });
        const data = await res.json();
        alert(data.message || "Operación realizada");
    } catch (e) {
        alert("Error al conectar con el servidor");
    }
}

// 2. BANEAR / BLOQUEAR (Toggle)
async function toggleBloqueo(userId) {
    if (!confirm("¿Seguro que deseas cambiar el estado de acceso de este usuario?")) return;

    try {
        const res = await fetch(`${API_URL}/admin/toggle-block`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userId })
        });
        if (res.ok) {
            alert("Estado de bloqueo actualizado");
            buscarUsuarioProfundo(); 
        }
    } catch (e) {
        alert("Error al procesar el bloqueo");
    }
}

// 3. SUSPENDER POR DÍAS
async function suspenderUsuario(userId) {
    const dias = prompt("¿Cuántos días de suspensión desea aplicar?");
    if (!dias || isNaN(dias)) return alert("Debes ingresar un número de días válido.");

    try {
        const res = await fetch(`${API_URL}/admin/suspend-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userId, dias: parseInt(dias) })
        });
        if (res.ok) {
            alert(`Usuario suspendido por ${dias} días.`);
            buscarUsuarioProfundo();
        } else {
            const data = await res.json();
            alert(data.message || "Error al suspender");
        }
    } catch (e) {
        alert("Error de conexión");
    }
}

// 2. HELPER PARA FILAS DEL HISTORIAL
function generarFilasHistorial(deposits, withdrawals) {
    const todos = [
        ...deposits.map(d => ({ t: 'DEPÓSITO', a: d.amountUSD, f: d.createdAt, s: d.status })),
        ...withdrawals.map(w => ({ t: 'RETIRO', a: w.amount, f: w.createdAt, s: w.status }))
    ].sort((a, b) => new Date(b.f) - new Date(a.f)).slice(0, 10); // Últimos 10

    if (todos.length === 0) return '<p style="padding:10px; text-align:center;">Sin movimientos registrados.</p>';

    return todos.map(m => `
        <div class="row">
            <span style="font-size:0.7rem;">${m.t}</span>
            <span style="color:${m.a >= 0 ? '#2ecc71' : '#e74c3c'}">$${Math.abs(m.a).toFixed(2)}</span>
            <span style="font-size:0.7rem;">${new Date(m.f).toLocaleDateString()}</span>
            <span style="font-size:0.7rem;">${m.s.toUpperCase()}</span>
        </div>
    `).join('');
}

function cerrarExpediente() {
    document.getElementById('seccion-expediente').style.display = 'none';
}

// 3. CARGAR AUDITORÍA GLOBAL (QUIÉN HIZO QUÉ)
async function cargarAuditoriaGlobal() {
    const container = document.getElementById('lista-auditoria-general');
    const totalWithdrawalsElem = document.getElementById('stat-withdrawals'); 
    const totalDepositsElem = document.getElementById('stat-deposits'); // Agregamos el cuadro de depósitos
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/admin/transactions/all`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const transactions = await res.json();

        // --- CÁLCULO DE TOTALES PARA EL DASHBOARD ---

       // --- DENTRO DE cargarAuditoriaGlobal ---

const sumaDepositos = transactions

            .filter(t => t.type === 'deposit' && (t.status === 'completed' || t.status === 'approved'))

            .reduce((acc, t) => acc + Math.abs(t.amount), 0);



        // 2. Sumar Retiros (Solo tipo 'withdraw' y que estén 'completed' o 'approved')

        const sumaRetiros = transactions

            .filter(t => t.type === 'withdraw' && (t.status === 'completed' || t.status === 'approved'))

            .reduce((acc, t) => acc + Math.abs(t.amount), 0);



        // Actualizamos los cuadros en la interfaz

        if (totalDepositsElem) {

            totalDepositsElem.innerText = `$${sumaDepositos.toFixed(2)}`;

        }

        if (totalWithdrawalsElem) {

            totalWithdrawalsElem.innerText = `$${sumaRetiros.toFixed(2)}`;

        }
        // --------------------------------------------

        container.innerHTML = transactions.slice(0, 30).map(t => {
            const nombreUsuario = t.userId ? t.userId.username : '<span style="color:#666; font-style:italic;">Eliminado</span>';
            const colorMonto = t.amount >= 0 ? '#2ecc71' : '#ff4d4d';
            
            let statusDisplay = t.status === 'completed' ? 'APROBADO' : t.status.toUpperCase();
            const adminResponsable = t.approvedBy || 'System';

            return `
                <div class="row">
                    <span>${new Date(t.createdAt).toLocaleDateString()}</span>
                    <span>${nombreUsuario}</span>
                    <span style="font-size: 0.8rem; opacity: 0.8;">${t.type.toUpperCase()}</span>
                    <span style="color: ${colorMonto}; font-weight: bold;">$${Math.abs(t.amount).toFixed(2)}</span>
                    <span style="color: #f4a261; font-weight: bold;">${adminResponsable} (${statusDisplay})</span>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Error en auditoría:", e);
        container.innerHTML = '<p>Error cargando auditoría.</p>';
    }
}

// --- UTILIDADES MODALES ---
let withdrawalIdParaRechazar = null;

function abrirModalRechazo(id) {
    withdrawalIdParaRechazar = id;
    document.getElementById('modal-rechazo').style.display = 'flex';
}

function cerrarModalRechazo() {
    document.getElementById('modal-rechazo').style.display = 'none';
    document.getElementById('reject-reason').value = '';
}

function abrirModalAjuste() { document.getElementById('modalAjuste').style.display = 'flex'; }
function cerrarModal() { document.getElementById('modalAjuste').style.display = 'none'; }

// Configurar el click del botón de confirmación de rechazo (solo una vez)
const confirmRejectBtn = document.getElementById('btn-confirm-reject');
if (confirmRejectBtn) {
    confirmRejectBtn.onclick = async () => {
        const reason = document.getElementById('reject-reason').value;
        if(!reason) return alert("Motivo obligatorio");

        const res = await fetch(`${API_URL}/admin/withdrawals/reject/${withdrawalIdParaRechazar}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ reason })
        });

        if (res.ok) {
            alert("Retiro rechazado y saldo devuelto.");
            cerrarModalRechazo();
            cargarRetirosAdmin();
        }
    };
}
function copiarTexto(texto) {
    if (!texto || texto === '---') return;
    navigator.clipboard.writeText(texto).then(() => {
        // Crear un aviso flotante pequeño en lugar de un alert molesto
        const aviso = document.createElement('div');
        aviso.innerText = "¡Copiado!";
        aviso.style = "position:fixed; bottom:20px; right:20px; background:#f4a261; color:black; padding:10px; border-radius:5px; z-index:10000;";
        document.body.appendChild(aviso);
        setTimeout(() => aviso.remove(), 2000);
    }).catch(err => {
        console.error('Error al copiar', err);
    });
}

function abrirModalAjuste(emailUsuario = "") {
    const modal = document.getElementById('modalAjuste');
    if (modal) {
        modal.style.display = 'flex';
        // Si venimos del "Expediente X", ponemos el email automáticamente
        if (emailUsuario) {
            const inputId = document.getElementById('adj-identifier');
            if (inputId) inputId.value = emailUsuario;
        }
    }
}

async function loguearComoUsuario(email) {
    if (!confirm("¿Deseas entrar a la cuenta de " + email + "?")) return;

    try {
        const res = await fetch(`https://cripto-home.onrender.com/api/admin/impersonate/${email}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem("token")}`, 
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Error al generar acceso");
        }

        const data = await res.json();

        // Guardamos el token del usuario para ver lo que él ve
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        alert("Acceso concedido como: " + data.user.username);
        
        // Redirigir al dashboard real
        window.location.href = "../dashboard/user.html"; 

    } catch (e) {
        alert("Fallo al controlar cuenta: " + e.message);
    }
}

// 1. Función auxiliar (ponla al final de tu archivo o antes de crearNuevaRed)
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// 2. Función crearNuevaRed mejorada
async function crearNuevaRed() {
    const network = document.getElementById('net-name').value;
    const currency = document.getElementById('net-curr').value;
    const depositAddress = document.getElementById('net-addr').value;
    const type = document.getElementById('net-type').value;
    const qrFile = document.getElementById('net-qr-file').files[0];

    if (!network || !currency) return alert("Red y Moneda son obligatorios");

    let finalQr = "";
    
    // Si el usuario subió una imagen, la convertimos a Base64
    if (qrFile) {
        try {
            finalQr = await toBase64(qrFile);
        } catch (e) {
            console.error("Error procesando imagen", e);
        }
    }

    const data = {
        network,
        currency,
        depositAddress,
        qrCode: finalQr, // Aquí va la imagen convertida en texto
        type
    };

    try {
        const res = await fetch(`${API_URL}/networks`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(data)
        });

        if(res.ok) {
            alert("✅ Nueva red configurada correctamente");
            // Limpiar campos
            document.getElementById('net-name').value = "";
            document.getElementById('net-curr').value = "";
            document.getElementById('net-addr').value = "";
            document.getElementById('net-qr-file').value = "";
            
            listarRedesAdmin();
        } else {
            const errorData = await res.json();
            alert("❌ Error: " + (errorData.message || "No se pudo crear"));
        }
    } catch (e) {
        alert("Error de conexión con el servidor");
    }
}

async function listarRedesAdmin() {
    try {
        const res = await fetch(`${API_URL}/networks/admin-list`, { // Asegúrate que esta ruta exista en tu backend
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const redes = await res.json();
        const container = document.getElementById('contenedor-redes');
        
        if (!container) return;

        container.innerHTML = redes.map(r => `
            <div style="background: #1a3a5a; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid ${r.isActive ? '#2ecc71' : '#95a5a6'}; margin-bottom: 8px;">
                <div style="flex-grow: 1;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <strong>${r.currency} (${r.network})</strong>
                        <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; background: ${r.type === 'deposit' ? '#27ae60' : '#2980b9'}; color: white;">
                            ${r.type === 'deposit' ? 'DEPÓSITO' : 'RETIRO'}
                        </span>
                    </div>
                    <small style="color: #bdc3c7; display: block; margin-top: 4px; word-break: break-all;">${r.depositAddress || 'Dirección de retiro'}</small>
                </div>
                ${r.qrCode ? `<img src="${r.qrCode}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; background: white; margin-left: 10px;">` : ''}
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="toggleEstadoRed('${r._id}')" style="background: ${r.isActive ? '#e67e22' : '#2ecc71'}; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; min-width: 80px;">
                        ${r.isActive ? 'Pausar' : 'Activar'}
                    </button>
                    
                    <button onclick="eliminarRed('${r._id}')" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 1.2rem;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Error listando redes:", e);
    }
}

// FUNCIÓN PARA EL BOTÓN DE PAUSAR/ACTIVAR
async function toggleEstadoRed(id) {
    try {
        const res = await fetch(`${API_URL}/networks/toggle-status/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            listarRedesAdmin(); // Refresca la lista
        }
    } catch (e) {
        alert("Error al cambiar estado");
    }
}

// FUNCIÓN PARA EL BOTÓN DE ELIMINAR
async function eliminarRed(id) {
    if (!confirm("¿Seguro que quieres eliminar esta red permanentemente?")) return;
    try {
        const res = await fetch(`${API_URL}/networks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            listarRedesAdmin();
        }
    } catch (e) {
        alert("Error al eliminar");
    }
}

