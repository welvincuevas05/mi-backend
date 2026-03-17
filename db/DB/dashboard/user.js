const API_URL = 'https://cripto-home.onrender.com/api';
const token = localStorage.getItem('token');

// Variable global para almacenar las redes y no pedirlas al servidor a cada rato
let redesCache = [];

// Bloqueo de funciones sensibles para rol soporte
function ejecutarAccionSegura(callback) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user.role === 'support') {
        alert("🛑 Error: Soporte no tiene permiso para realizar operaciones financieras.");
        return;
    }
    callback();
}

// Ejemplo de cómo protegerías el botón de Ajustar Saldo en el expediente de Admin:
// <button onclick="ejecutarAccionSegura(() => abrirModalAjuste(...))"> ... </button>

/* =========================================
   1. GESTIÓN DEL HOME (BALANCES Y RESUMEN)
   ========================================= */

async function actualizarHome() {
    if (!token) {
        window.location.href = "../auth/login.html";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;
        const user = await res.json();

        // 1. Cargamos el ID del usuario
        const displayId = document.getElementById('display-id');
        if (displayId) {
            const shortId = user._id ? user._id.slice(-6).toUpperCase() : '000000';
            displayId.innerText = `${user.username} | ID: ${shortId}`;
        }

        // 2. Cargamos Balances
        const availElement = document.getElementById('balance-avail');
        const frozenElement = document.getElementById('balance-frozen');
        
        if (availElement) availElement.innerText = `$${user.balanceAvailable.toFixed(2)}`;
        if (frozenElement) frozenElement.innerText = `$${user.balanceFrozen.toFixed(2)}`;

        // 3. Lanzamos las cargas de datos dinámicos
        cargarIngresosDiarios();
        cargarMisVipsActivos(); // Sustituye al antiguo historial en el home

    } catch (e) {
        console.error("Error al cargar Home:", e);
    }
}

// NUEVA FUNCIÓN: Ahora vive afuera de actualizarHome
async function cargarMisVipsActivos() {
    const container = document.getElementById('home-vip-list');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/user/my-investments`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const inversiones = await res.json();

        if (!inversiones || inversiones.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align:center; padding: 15px;">Aún no tienes planes activos.</p>';
            return;
        }

        // En user.js (dentro de cargarMisVipsActivos)
// En user.js -> cargarMisVipsActivos
container.innerHTML = inversiones.map(inv => {
    const nombreVIP = inv.vipProduct ? inv.vipProduct.name : "Plan VIP";
    const lastClaimDate = new Date(inv.lastClaim).getTime();
    const nextClaimDate = lastClaimDate + (24 * 60 * 60 * 1000);
    const ahora = new Date().getTime();
    const faltanMs = nextClaimDate - ahora;

    return `
        <div class="vip-active-card" style="...">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: bold; color: #fff;">${nombreVIP}</div>
                    <div style="color: #2ecc71;">+$${inv.dailyProfit.toFixed(2)} / día</div>
                </div>
                <div>
                    <div id="timer-${inv._id}" style="font-size: 0.75rem; color: #ffa500; text-align: center; margin-bottom: 5px;">
                        --:--:--
                    </div>
                    <button id="btn-claim-${inv._id}" 
                        onclick="reclamarGanancia('${inv._id}')" 
                        class="btn-claim"
                        ${faltanMs > 0 ? 'disabled style="background: #444; color: #888; cursor: not-allowed;"' : 'style="background: #ffa500; color: #000; cursor: pointer;"'} 
                        style="border: none; padding: 8px 15px; border-radius: 5px; font-weight: bold;">
                        ${faltanMs > 0 ? 'Esperar' : 'Reclamar'}
                    </button>
                </div>
            </div>
        </div>
    `;
}).join('');

// Lanzar el actualizador de timers
inversiones.forEach(inv => iniciarContador(inv._id, inv.lastClaim));
    } catch (error) {
        console.error("Error cargando VIPs activos:", error);
        container.innerHTML = '<p style="color: gray; text-align: center;">Sin inversiones activas.</p>';
    }
}

async function cargarIngresosDiarios() {
    const display = document.getElementById('ingresos-diarios');
    if (!display) return;

    try {
        const res = await fetch(`${API_URL}/user/daily-earnings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        // Si data.dailyEarnings existe, lo usamos, si no, ponemos 0
        const ganancia = data.dailyEarnings !== undefined ? data.dailyEarnings : 0;
        
        display.innerText = `+$${ganancia.toFixed(2)}`;
    } catch (error) {
        console.error("Error en el fetch de ingresos:", error);
        display.innerText = "+$0.00";
    }
}

async function cargarResumenHome() {
    const container = document.getElementById('home-transactions-list');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/user/my-transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const transactions = await res.json();

        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<p style="color: #888;">No hay movimientos recientes.</p>';
            return;
        }

        const resumen = transactions.slice(0, 3);
        container.innerHTML = resumen.map(t => {
            const esNegativo = t.amount < 0;
            const color = esNegativo ? '#ff4d4d' : '#2ecc71';
            const simbolo = esNegativo ? '' : '+';
            return `
                <div class="trans-item" style="margin-bottom: 8px; font-size: 0.95rem; display: flex; gap: 8px;">
                    <span style="color: ${color}; font-weight: bold;">${simbolo}$${t.amount.toFixed(2)}</span> 
                    <span style="color: #eee;">${t.description || t.type}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p>Error al cargar transacciones.</p>';
    }
}

/* =========================================
   2. SECCIÓN DE HISTORIAL COMPLETO
   ========================================= */

async function cargarMisTransacciones() {
    const listContainer = document.getElementById('user-transactions-list');
    if (!listContainer) return;

    try {
        const res = await fetch(`${API_URL}/user/my-transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const transactions = await res.json();

        if (!transactions || transactions.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Aún no tienes movimientos registrados.</p>';
            return;
        }

        listContainer.innerHTML = transactions.map(t => {
            const fecha = new Date(t.date || t.createdAt).toLocaleDateString();
            const esNegativo = t.amount < 0;
            const color = esNegativo ? '#ff4d4d' : '#2ecc71';
            return `
                <div class="transaction-card" style="border-left: 4px solid ${color}; background: #1a1a1a; padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="trans-info" style="display: flex; flex-direction: column;">
                        <span class="trans-date" style="font-size: 0.75rem; color: #888;">${fecha} - ${t.type.toUpperCase()}</span>
                        <span class="trans-desc" style="color: #fff; margin-top: 4px;">${t.description || 'Ajuste de saldo'}</span>
                    </div>
                    <div class="trans-amount" style="font-weight: bold; font-size: 1.1rem; color: ${color}">
                        ${esNegativo ? '' : '+'}$${t.amount.toFixed(2)}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        listContainer.innerHTML = '<p style="color: red; text-align: center;">Error al conectar con el servidor.</p>';
    }
}

/* =========================================
   3. SECCIÓN DE DEPÓSITOS
   ========================================= */

async function cargarDatosDeposito() {
    try {
        const res = await fetch(`${API_URL}/networks/user-list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        redesCache = await res.json();
        
        // REVISIÓN: Mira en la consola si 'qrCode' aparece con el texto largo
        console.log("Redes cargadas:", redesCache);

        const select = document.getElementById('select-network');
        if (select) {
            if (redesCache.length === 0) {
                select.innerHTML = '<option value="">No hay opciones disponibles</option>';
                return;
            }
            select.innerHTML = '<option value="">Selecciona moneda y red</option>' + 
                redesCache.map(n => `
                    <option value="${n._id}">
                        ${n.currency} (${n.network})
                    </option>
                `).join('');
        }
    } catch (e) {
        console.error("Error al cargar redes:", e);
    }
}

function cambiarRed() {
    const id = document.getElementById('select-network').value;
    const zone = document.getElementById('payment-zone');
    const selectCurrency = document.getElementById('select-currency');
    const qrImg = document.getElementById('img-qr');
    
    // Buscamos la red en la caché
    const seleccion = redesCache.find(n => n._id === id);

    if (seleccion) {
        zone.style.display = 'block';
        
        // 1. Datos de texto
        document.getElementById('wallet-addr').innerText = seleccion.depositAddress || "Sin dirección";
        document.getElementById('name-red').innerText = seleccion.network;
        
        // 2. Sincronizar moneda
        if (selectCurrency) {
            selectCurrency.innerHTML = `<option value="${seleccion.currency.toLowerCase()}">${seleccion.currency}</option>`;
        }
        
        // 3. Carga EXCLUSIVA desde Base de Datos (Base64)
        if (qrImg) {
            if (seleccion.qrCode && seleccion.qrCode.startsWith('data:image')) {
                console.log("✅ QR detectado en Base64. Renderizando...");
                qrImg.src = seleccion.qrCode;
            } else {
                console.warn("⚠️ Esta red no tiene una imagen Base64 válida en la DB.");
                // Imagen por defecto si no hay QR en la DB
                qrImg.src = "../../assets/qrs/img-qr.png"; 
            }

            // Si el texto Base64 está mal formado, el navegador lanzará error y pondremos el genérico
            qrImg.onerror = () => {
                qrImg.src = "../../assets/qrs/img-qr.png";
            };
        }
    } else {
        if (zone) zone.style.display = 'none';
    }
}

function copiarTexto(id) {
    const texto = document.getElementById(id).innerText;
    navigator.clipboard.writeText(texto);
    alert("¡Copiado al portapapeles!");
}

async function enviarDeposito() {
    const network = document.getElementById('select-network').value;
    const amount = document.getElementById('depo-amount').value;
    const txid = document.getElementById('depo-txid').value;
    const btn = document.getElementById('btn-submit-depo');

    if (!network || !amount || !txid) return alert("Por favor complete todos los campos.");
    if (amount < 10) return alert("Monto mínimo permitido: $10.00 USD.");

    btn.disabled = true;
    btn.innerText = "Enviando...";

    try {
        const res = await fetch(`${API_URL}/deposits`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ network, amount, txid })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ Solicitud enviada. El administrador revisará tu pago pronto.");
            load('home');
        } else {
            alert("❌ " + data.message);
            btn.disabled = false;
            btn.innerText = "Informar Pago";
        }
    } catch (e) {
        alert("Error de conexión con el servidor.");
        btn.disabled = false;
        btn.innerText = "Informar Pago";
    }
}

/* =========================================
   4. SECCIÓN VIP (INVERSIONES)
   ========================================= */

async function cargarPlanesVIP() {
    const container = document.getElementById('vip-list');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/vip/all`);
        const planes = await res.json();

        container.innerHTML = planes.map(plan => `
            <div class="vip-card-v2">
                <div style="position: absolute; right: 20px; top: 20px; font-size: 1.5rem; opacity: 0.2;">💎</div>
                <h4>${plan.name}</h4>
                
                <div class="plan-info">
                    <p>Inversión: <strong>$${plan.price}</strong></p>
                    <p>Retorno Diario: <span class="profit-text">+$${plan.dailyProfit}</span></p>
                </div>

                <button class="btn-vip-action" onclick="comprarVIP('${plan._id}', ${plan.price})">
                    Activar Plan Now
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error("Error:", e);
    }
}

async function comprarVIP(vipId, amount) {
    if (!token) return alert("Sesión expirada");
    if (!confirm(`¿Deseas invertir $${amount} en este plan?`)) return;

    try {
        const res = await fetch(`${API_URL}/invest`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ vipId, amount })
        });

        const data = await res.json();
        if (res.ok) {
            alert("¡Inversión exitosa!");
            actualizarHome();
        } else {
            alert(data.msg || "Error al procesar inversión");
        }
    } catch (e) {
        alert("Error de conexión.");
    }
}

/* === Función Auxiliar para Cálculos Visuales === */
function calcularComision() {
    const amountInput = document.getElementById('withdraw-amount');
    const feeDisplay = document.getElementById('fee-amount');
    const totalDisplay = document.getElementById('total-receive');
    
    if (!amountInput || !feeDisplay || !totalDisplay) return;

    const amount = parseFloat(amountInput.value) || 0;
    const fee = amount * 0.05; // 5% estático
    const receive = amount - fee;

    feeDisplay.innerText = `$${fee.toFixed(2)}`;
    totalDisplay.innerText = `$${(receive > 0 ? receive : 0).toFixed(2)}`;
}

/* === Tu función original con los ajustes de 5$ y 5% === */
async function solicitarRetiro() {
    const amount = document.getElementById('withdraw-amount').value;
    const network = document.getElementById('withdraw-network').value;
    const address = document.getElementById('withdraw-address').value;
    const btn = document.getElementById('btn-submit-withdraw');

    // 1. Obtener el token actualizado del localStorage
    const token = localStorage.getItem("token");

    // 2. Validaciones básicas (Actualizado mínimo a 5$)
    if (!token) return alert("Sesión expirada. Por favor, inicia sesión de nuevo.");
    if (!amount || !address) return alert("Completa todos los campos");
    
    const numAmount = Number(amount);
    if (numAmount < 5) return alert("El monto mínimo de retiro es de $5.00"); // <-- Cambio aquí

    // Cálculo de comisión para el mensaje de confirmación
    const fee = numAmount * 0.05;
    const toReceive = numAmount - fee;
    
    if (!confirm(`¿Confirmas el retiro de $${numAmount}?\nComisión (5%): $${fee.toFixed(2)}\nRecibirás: $${toReceive.toFixed(2)}\nRed: ${network}`)) return;

    btn.disabled = true;
    btn.innerText = "Procesando...";

    try {
        // 3. Petición al backend
        const res = await fetch(`${API_URL}/withdrawals/request`, { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                amount: numAmount, 
                network, 
                address,
                fee: fee // Se envía la comisión calculada
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ " + data.message);
            if (typeof load === "function") {
                load('home');
            } else {
                window.location.reload();
            }
        } else {
            alert("❌ " + (data.message || "Error al procesar el retiro"));
            btn.disabled = false;
            btn.innerText = "Solicitar Retiro";
        }

    } catch (e) {
        console.error("Error en fetch retiro:", e);
        alert("⚠️ Error de conexión: No se pudo contactar con el servidor.");
        btn.disabled = false;
        btn.innerText = "Solicitar Retiro";
    }
}
/* =========================================
   5. MANEJO DE SECCIONES (SPA)
   ========================================= */

window.addEventListener('load-section', (e) => {
    const seccion = e.detail;
    console.log("Sección cargada detectada:", seccion); // Para ver en F12
    
    if (seccion === 'home') {
        actualizarHome();
    } else if (seccion === 'transacciones') {
        cargarMisTransacciones();
    } else if (seccion === 'perfil') {
        cargarDatosPerfil();
    } else if (seccion === 'vip') {
        cargarPlanesVIP();
    } else if (seccion === 'deposito') {
        cargarDatosDeposito();
    } else if (seccion === 'retiro') { // <--- ¡AÑADE ESTO!
        console.log("Activando carga de redes de retiro...");
        cargarOpcionesRetiro(); // Esta es la función que ya tienes creada
    } else if (seccion === 'invitados') {
        console.log("Activando carga de referidos...");
        actualizarSeccionInvitados();
    }
});

async function reclamarGanancia(userVipId) {
    if (!confirm("¿Deseas reclamar tu ganancia diaria?")) return;

    try {
        const res = await fetch(`${API_URL}/vip/claim/${userVipId}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ " + data.message);
            actualizarHome(); // Refresca el balance disponible
        } else {
            // Aquí te avisará si aún no pasan las 24 horas
            alert("⏳ " + data.message);
        }
    } catch (error) {
        console.error("Error al reclamar:", error);
        alert("Error de conexión al reclamar.");
    }
}

function iniciarContador(id, lastClaim) {
    const timerDisplay = document.getElementById(`timer-${id}`);
    const btn = document.getElementById(`btn-claim-${id}`);
    if (!timerDisplay) return;

    const actualizar = () => {
        const ahora = new Date().getTime();
        const proximoReclamo = new Date(lastClaim).getTime() + (24 * 60 * 60 * 1000);
        const distancia = proximoReclamo - ahora;

        if (distancia <= 0) {
            timerDisplay.innerText = "¡Listo para reclamar!";
            btn.disabled = false;
            btn.innerText = "Reclamar";
            btn.style.background = "#ffa500";
            btn.style.color = "#000";
            return; // Detener el intervalo si ya llegó a cero
        }

        const horas = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((distancia % (1000 * 60)) / 1000);

        timerDisplay.innerText = `${horas}h ${minutos}m ${segundos}s`;
        btn.disabled = true;
    };

    actualizar();
    setInterval(actualizar, 1000);
}

// Usa esta función única y robusta
// ✅ FUNCIÓN ÚNICA Y ROBUSTA PARA REFERIDOS
async function actualizarSeccionInvitados() {
    const tabla = document.getElementById("tablaReferidos");
    
    try {
        // 1. Mostrar estado de carga (opcional pero profesional)
        if (tabla && tabla.innerHTML === "") {
            tabla.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Cargando red...</td></tr>';
        }

        const response = await fetch(`${API_URL}/user/referrals/stats`, {
            headers: { 
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) throw new Error("Error en la respuesta del servidor");
        
        const data = await response.json();

        // 2. LÓGICA DEL CÓDIGO DE INVITACIÓN
        const linkContainer = document.getElementById("myReferralLink");
        if (linkContainer && data.referralCode) {
            linkContainer.innerHTML = `<span style="color: #ffa500; font-size: 1.2rem; font-weight: bold; letter-spacing: 1px;">${data.referralCode}</span>`;
            linkContainer.dataset.code = data.referralCode;
        }

        // 3. ACTUALIZAR CONTADORES (Niveles)
        const actualizarTexto = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.innerText = valor || 0;
        };

        actualizarTexto("count-l1", data.counts?.l1);
        actualizarTexto("count-l2", data.counts?.l2);
        actualizarTexto("count-l3", data.counts?.l3);

        // 4. TOTAL GANANCIAS (Aseguramos que sea número)
        const totalCommissionsDisplay = document.getElementById("totalCommissionsDisplay");
        if (totalCommissionsDisplay) {
            const total = Number(data.totalCommissions) || 0;
            totalCommissionsDisplay.innerText = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // 5. LLENAR TABLA DE REFERIDOS
        if (tabla) {
            if (!data.allReferrals || data.allReferrals.length === 0) {
                tabla.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color: #888;">No hay actividad en tu red aún</td></tr>';
            } else {
                // Ordenar por nivel o fecha si fuera necesario, aquí mapeamos directo
                tabla.innerHTML = data.allReferrals.map(ref => {
                    const dep = Number(ref.deposito) || 0;
                    const gan = Number(ref.ganancia) || 0;
                    
                    return `
                        <tr style="border-bottom: 1px solid #222;">
                            <td style="padding: 12px; font-weight: 500;">${ref.username}</td>
                            <td style="padding: 12px;"><span style="background: #333; padding: 2px 8px; border-radius: 4px; color: #ffa500; font-size: 0.85rem;">Niv ${ref.nivel}</span></td>
                            <td style="padding: 12px;">$${dep.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td style="padding: 12px; color: #2ecc71; font-weight: bold;">
                                +$${gan.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

    } catch (error) {
        console.error("❌ Error cargando sección de invitados:", error);
        if (tabla) {
            tabla.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color: #ff4d4d;">Error al conectar con el servidor</td></tr>';
        }
    }
}

function copiarEnlace() {
    const linkContainer = document.getElementById("myReferralLink");
    // Obtenemos el código que guardamos en el dataset.code anteriormente
    const codigoACopiar = linkContainer.dataset.code;

    if (!codigoACopiar) {
        alert("El código aún no se ha cargado.");
        return;
    }

    navigator.clipboard.writeText(codigoACopiar).then(() => {
        // Feedback visual en el botón
        const btn = document.querySelector(".invitados .btn");
        const originalText = btn.innerText;
        btn.innerText = "¡Copiado!";
        btn.style.backgroundColor = "#2ecc71";
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.backgroundColor = ""; 
        }, 2000);
    }).catch(err => {
        console.error("No se pudo copiar el código:", err);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    actualizarHome();
});

// Carga los datos reales del usuario en la sección perfil
async function cargarDatosPerfil() {
    try {
        const res = await fetch(`${API_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await res.json();

        if (res.ok) {
            document.getElementById('perf-id').innerText = user._id.slice(-6).toUpperCase();
            document.getElementById('perf-username').innerText = user.username;
            document.getElementById('perf-email').innerText = user.email;
            
            const statusEl = document.getElementById('perf-status');
            statusEl.innerText = user.isBlocked ? "Suspendido" : "Activo";
            statusEl.style.color = user.isBlocked ? "#e74c3c" : "#2ecc71";
        }
    } catch (e) {
        console.error("Error cargando perfil:", e);
    }
}

// Función para cambiar contraseña desde el perfil
async function cambiarPassword() {
    const newPass = prompt("Ingresa tu nueva contraseña (mínimo 6 caracteres):");
    
    if (!newPass || newPass.length < 6) {
        return alert("Contraseña inválida o muy corta.");
    }

    try {
        const res = await fetch(`${API_URL}/user/update-password`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password: newPass })
        });

        const data = await res.json();
        if (res.ok) {
            alert("✅ Contraseña actualizada con éxito.");
        } else {
            alert("❌ " + data.message);
        }
    } catch (e) {
        alert("Error de conexión.");
    }
}

// Función para mostrar/ocultar el menú de clave
function toggleMenuClave() {
    const menu = document.getElementById('menu-clave');
    menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
}

async function procesarCambioPassword() {
    const oldP = document.getElementById('old-pass').value;
    const newP = document.getElementById('new-pass').value;
    const confP = document.getElementById('confirm-new-pass').value;

    if (!oldP || !newP || newP !== confP) {
        return alert("Verifica que los campos estén completos y las contraseñas coincidan.");
    }

    try {
        const res = await fetch(`${API_URL}/user/update-password`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            // SINCRONIZADO CON TU BACKEND:
            body: JSON.stringify({ 
                oldPassword: oldP, 
                newPassword: newP 
            })
        });

        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            toggleMenuClave(); // Cierra el menú al terminar
        } else {
            alert("❌ " + data.message);
        }
    } catch (e) {
        alert("Error de comunicación. Asegúrate de haber subido los cambios al servidor.");
    }
}

let redesCargadas = [];


async function cargarOpcionesRetiro() {
    try {
        console.log("Cargando opciones de retiro...");
        const res = await fetch(`${API_URL}/networks/user-list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const todas = await res.json();
        
        // Filtramos por tipo 'withdrawal' y que estén activas
        const redesRetiro = todas.filter(r => r.type === 'withdrawal' && r.isActive);

        const select = document.getElementById('withdraw-network');
        if (!select) return;

        if (redesRetiro.length === 0) {
            select.innerHTML = '<option value="">No hay redes de retiro disponibles</option>';
            return;
        }

        // IMPORTANTE: Usamos r.currency para que aparezca "BNB" o lo que guardaste
        select.innerHTML = '<option value="">Selecciona red de destino</option>' + 
            redesRetiro.map(r => 
                `<option value="${r.network}">${r.currency} (${r.network})</option>`
            ).join('');

        console.log("Redes de retiro cargadas con éxito");
    } catch (e) {
        console.error("Error cargando redes de retiro:", e);
    }
}

/**
 * Calcula la comisión del 5% mientras el usuario escribe
 */
function calcularComision() {
    const montoInput = document.getElementById('withdraw-amount');
    const feeDisplay = document.getElementById('fee-amount');
    const totalDisplay = document.getElementById('total-receive');
    
    const monto = parseFloat(montoInput.value) || 0;
    
    // Cálculo: 5% de comisión
    const comision = monto * 0.05;
    const totalARecibir = monto - comision;

    // Actualizar vista
    feeDisplay.innerText = `$${comision.toFixed(2)}`;
    totalDisplay.innerText = `$${(totalARecibir > 0 ? totalARecibir : 0).toFixed(2)}`;
}

