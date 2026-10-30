const SUPABASE_URL = 'https://mmnckyhjbttkpzkrymfw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jSJxPFABajXRaxaldYsD-w__7QoxujB';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    actualizarNavegacion(session);

    const path = window.location.pathname.toLowerCase();

    if (path.includes('perfil.html') || path.includes('perfil_2.html')) {
        if (!session) {
            window.location.href = 'iniciar sesion.html';
        } else {
            await cargarPerfilUsuario(session.user);
            cargarMisTutoriasPerfil(session.user.id);
        }
    }

    if (path.includes('buscar') || path.includes('tutor')) {
        cargarTodasLasTutoriasPublicas();
    }
});

function actualizarNavegacion(session) {
    const btnIniciarSesion = document.querySelector('a[href*="iniciar"]');
    const btnRegistrarme = document.querySelector('a[href*="registrar"]');
    
    if (session) {
        if (btnIniciarSesion) btnIniciarSesion.style.display = 'none';
        if (btnRegistrarme) {
            btnRegistrarme.textContent = 'Mi Perfil';
            btnRegistrarme.href = 'perfil.html';
        }
    }
}

const signupForm = document.querySelector('form[data-auth-form="signup"]');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name')?.value;
        const email = document.getElementById('email')?.value;
        const career = document.getElementById('career')?.value;
        const cycle = document.getElementById('cycle')?.value;
        const password = document.getElementById('password')?.value;

        try {
            const { data, error: signUpError } = await supabaseClient.auth.signUp({ email, password });
            if (signUpError) throw signUpError;

            if (data.user) {
                const { error: profileError } = await supabaseClient.from('profiles').insert([
                    { id: data.user.id, full_name: name, email, career, cycle }
                ]);
                if (profileError) throw profileError;

                alert('¡Registro exitoso! Bienvenido a StudyHUB.');
                window.location.href = 'index.html';
            }
        } catch (error) {
            alert('Error al registrarse: ' + error.message);
        }
    });
}

const loginForm = document.querySelector('form[data-auth-form="login"]');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;

            const { data: profileCheck } = await supabaseClient.from('profiles').select('id').eq('id', data.user.id).single();
            if (!profileCheck) {
                await supabaseClient.from('profiles').insert([
                    { id: data.user.id, email: data.user.email, full_name: data.user.email.split('@')[0], career: 'No especificada', cycle: '1.º ciclo' }
                ]);
            }

            alert('¡Inicio de sesión exitoso!');
            window.location.href = 'perfil.html';
        } catch (error) {
            alert('Error de acceso: ' + error.message);
        }
    });
}

async function cargarPerfilUsuario(user) {
    const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
    if (error) return;

    if (profile) {
        document.getElementById('perfil-nombre').textContent = profile.full_name || 'Usuario';
        document.getElementById('perfil-email').textContent = profile.email || user.email;
        document.getElementById('perfil-carrera').textContent = profile.career || 'No especificada';
        document.getElementById('perfil-ciclo').textContent = profile.cycle || 'No especificado';
        document.getElementById('perfil-telefono').textContent = profile.phone || 'No registrado';
        document.getElementById('perfil-bio-preview').textContent = profile.bio || 'Sin descripción aún.';

        if (profile.avatar_url) {
            document.getElementById('perfil-avatar').src = profile.avatar_url;
        }

        document.getElementById('edit-name').value = profile.full_name || '';
        document.getElementById('edit-phone').value = profile.phone || '';
        document.getElementById('edit-bio').value = profile.bio || '';

        const modalPhone = document.getElementById('tutoria-telefono');
        if (modalPhone) {
            modalPhone.value = profile.phone || '⚠️ Registra tu teléfono primero en editar perfil';
        }
    }
}

const formEditar = document.getElementById('form-editar-perfil');
if (formEditar) {
    formEditar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;

        const phoneInput = document.getElementById('edit-phone')?.value.trim();
        const phoneRegex = /^\+51\s?9\d{8}$/;
        if (!phoneRegex.test(phoneInput)) {
            alert('El teléfono debe tener el formato de Perú (+51 seguido de 9 dígitos, ej: +51987654321).');
            return;
        }

        let avatarUrl = null;
        const file = document.getElementById('edit-avatar-file')?.files[0];
        if (file) {
            const filePath = `avatars/${session.user.id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, file, { upsert: true });
            if (!uploadError) {
                avatarUrl = supabaseClient.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
            }
        }

        const updatedData = {
            full_name: document.getElementById('edit-name')?.value,
            phone: phoneInput,
            bio: document.getElementById('edit-bio')?.value
        };
        if (avatarUrl) updatedData.avatar_url = avatarUrl;

        const { error } = await supabaseClient.from('profiles').update(updatedData).eq('id', session.user.id);
        if (error) {
            alert('Error al actualizar: ' + error.message);
        } else {
            alert('¡Perfil actualizado con éxito!');
            cargarPerfilUsuario(session.user);
        }
    });
}

const modalTutoria = document.getElementById('modal-tutoria');
const btnAbrirModal = document.getElementById('btn-abrir-modal-tutoria');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');

if (btnAbrirModal && modalTutoria) {
    btnAbrirModal.addEventListener('click', async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) await cargarPerfilUsuario(session.user);
        modalTutoria.style.display = 'flex';
    });
}

if (btnCerrarModal && modalTutoria) {
    btnCerrarModal.addEventListener('click', () => { modalTutoria.style.display = 'none'; });
}

const formSubirTutoria = document.getElementById('form-subir-tutoria');
if (formSubirTutoria) {
    formSubirTutoria.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert('Debes iniciar sesión.');
            return;
        }

        const curso = document.getElementById('tutoria-curso').value.trim();
        const precio = document.getElementById('tutoria-precio').value.trim();
        const modalidad = document.getElementById('tutoria-modalidad').value;
        const descripcion = document.getElementById('tutoria-descripcion').value.trim();

        const { error: insertError } = await supabaseClient.from('tutorias').insert([
            { user_id: session.user.id, curso, precio: parseFloat(precio), modalidad, descripcion }
        ]);

        if (insertError) {
            alert('Error al publicar: ' + insertError.message);
        } else {
            alert('¡Tutoría publicada con éxito!');
            formSubirTutoria.reset();
            modalTutoria.style.display = 'none';
            cargarMisTutoriasPerfil(session.user.id);
        }
    });
}

async function cargarMisTutoriasPerfil(userId) {
    const contenedor = document.getElementById('contenedor-mis-tutorias');
    if (!contenedor) return;

    const { data: tutorias, error } = await supabaseClient.from('tutorias').select('*').eq('user_id', userId);
    if (error || !tutorias || tutorias.length === 0) {
        contenedor.innerHTML = '<p style="color: #64748b; font-size: 14px;">Aún no has publicado ninguna tutoría.</p>';
        return;
    }

    contenedor.innerHTML = tutorias.map(t => {
        const modalidadTexto = t.modalidad && t.modalidad.toLowerCase() === 'ambas' ? 'Presencial y Virtual' : (t.modalidad || 'Virtual');
        return `
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; background: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;">${modalidadTexto}</span>
                    <h4 style="margin: 10px 0 6px 0; color: #1e293b; font-size: 16px;">${t.curso}</h4>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #2563eb; font-weight: 700;">S/. ${t.precio} <span style="font-size: 12px; color: #64748b; font-weight: normal;">/ hora</span></p>
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #64748b; line-height: 1.4;">${t.descripcion || 'Sin descripción'}</p>
                </div>
                
                <div style="border-top: 1px solid #f1f5f9; padding-top: 10px; display: flex; justify-content: flex-end;">
                    <button type="button" class="btn-eliminar-tutoria" data-id="${t.id}" title="Eliminar tutoría" style="background: #fee2e2; color: #dc2626; border: none; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: background 0.2s;">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    contenedor.querySelectorAll('.btn-eliminar-tutoria').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const tutoriaId = e.currentTarget.getAttribute('data-id');
            if (confirm('¿Estás seguro de que deseas eliminar esta tutoría? Se borrará de tu perfil y de la búsqueda.')) {
                const { error: deleteError } = await supabaseClient.from('tutorias').delete().eq('id', tutoriaId);
                if (deleteError) {
                    alert('Error al eliminar: ' + deleteError.message);
                } else {
                    alert('Tutoría eliminada correctamente.');
                    cargarMisTutoriasPerfil(userId);
                }
            }
        });
    });
}


async function cargarTodasLasTutoriasPublicas() {
    const contenedorBusqueda = document.getElementById('contenedor-tarjetas-tutores');
    if (!contenedorBusqueda) return;

    const { data: tutorias, error } = await supabaseClient.from('tutorias').select('*');
    if (error || !tutorias || tutorias.length === 0) {
        contenedorBusqueda.innerHTML = '<p style="color: #64748b; grid-column: 1/-1; text-align: center; padding: 40px;">No hay tutorías publicadas todavía.</p>';
        return;
    }

    const { data: perfiles } = await supabaseClient.from('profiles').select('*');

    function renderizar(lista) {
        if (!lista || lista.length === 0) {
            contenedorBusqueda.innerHTML = '<p style="color: #64748b; grid-column: 1/-1; text-align: center; padding: 40px;">No se encontraron tutorías con esos criterios.</p>';
            return;
        }

        contenedorBusqueda.innerHTML = lista.map((t) => {
            const tutor = perfiles?.find(p => p.id === t.user_id) || {};
            const modalidadTexto = t.modalidad && t.modalidad.toLowerCase() === 'ambas' ? 'Presencial y Virtual' : (t.modalidad || 'Virtual');

            return `
                <div class="tarjeta-tutor-interactive" data-id="${t.id}" style="border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between; cursor: pointer;">
                    <div>
                        <span style="background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">${modalidadTexto}</span>
                        <h3 style="margin: 12px 0 6px 0; color: #1e293b; font-size: 18px;">${t.curso}</h3>
                        <p style="font-size: 18px; font-weight: 700; color: #2563eb; margin-bottom: 12px;">S/. ${t.precio} <span style="font-size: 12px; color: #64748b; font-weight: normal;">por hora</span></p>
                        <p style="font-size: 13px; color: #475569; margin-bottom: 20px; line-height: 1.5;">${t.descripcion || 'Sin descripción'}</p>
                    </div>
                    
                    <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 38px; height: 38px; background: #e0f2fe; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0284c7; font-size: 14px;">
                            ${(tutor.full_name || 'T').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p style="margin: 0; font-size: 13px; font-weight: 600; color: #1e293b;">${tutor.full_name || 'Tutor StudyHUB'}</p>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">${tutor.career || 'Estudiante'} • ${tutor.cycle || 'Ciclo no especificado'} • 📞 ${tutor.phone || 'No registrado'}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        contenedorBusqueda.querySelectorAll('.tarjeta-tutor-interactive').forEach(card => {
            card.addEventListener('click', () => {
                const idCard = card.getAttribute('data-id');
                const t = tutorias.find(item => item.id == idCard);
                const tutor = perfiles?.find(p => p.id === t.user_id) || {};
                mostrarModalEnfoque(t, tutor);
            });
        });
    }

    
    renderizar(tutorias);

  
    const inputCurso = document.querySelector('.input-curso');
    const selectModalidad = document.querySelector('.select-modalidad');
    const btnBuscar = document.querySelector('.btn-buscar-accion');

    function ejecutarFiltro() {
        const textoBusqueda = inputCurso ? inputCurso.value.toLowerCase().trim() : '';
        const modalidadFiltro = selectModalidad ? selectModalidad.value.toLowerCase().trim() : '';

        const filtradas = tutorias.filter(t => {
            const coincideCurso = t.curso.toLowerCase().includes(textoBusqueda);
            
            let coincideModalidad = true;
            if (modalidadFiltro) {
                if (modalidadFiltro === 'ambas') {
                    coincideModalidad = t.modalidad.toLowerCase() === 'ambas';
                } else {
                    coincideModalidad = t.modalidad.toLowerCase() === modalidadFiltro || t.modalidad.toLowerCase() === 'ambas';
                }
            }

            return coincideCurso && coincideModalidad;
        });

        renderizar(filtradas);
    }

    if (btnBuscar) {
        btnBuscar.addEventListener('click', ejecutarFiltro);
    }

    if (inputCurso) {
        inputCurso.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') ejecutarFiltro();
        });
    }
}

function mostrarModalEnfoque(t, tutor) {
    const modalExistente = document.getElementById('modal-detalle-tutoria');
    if (modalExistente) modalExistente.remove();

    const telefonoLimpio = tutor.phone ? tutor.phone.replace(/\D/g, '') : '';
    const mensajeWp = encodeURIComponent(`¡Hola ${tutor.full_name || 'Tutor'}! Vi tu anuncio de tutoría para el curso de ${t.curso} en StudyHUB y me interesa coordinar una clase.`);
    const enlaceWp = telefonoLimpio ? `https://wa.me/${telefonoLimpio}?text=${mensajeWp}` : '#';
    const modalidadTexto = t.modalidad && t.modalidad.toLowerCase() === 'ambas' ? 'Presencial y Virtual' : (t.modalidad || 'Virtual');

    const modalHTML = `
        <div id="modal-detalle-tutoria" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); z-index: 3000; display: flex; justify-content: center; align-items: center; padding: 20px; backdrop-filter: blur(5px);">
            <div style="background: white; padding: 35px; border-radius: 20px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); position: relative; box-sizing: border-box;">
                
                <button type="button" id="cerrar-modal-detalle" style="position: absolute; top: 20px; right: 20px; background: #f1f5f9; border: none; width: 34px; height: 34px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; font-weight: bold;">✕</button>

                <span style="background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">${modalidadTexto}</span>
                <h2 style="margin: 15px 0 8px 0; color: #1e293b; font-size: 24px;">${t.curso}</h2>
                <p style="font-size: 22px; font-weight: 700; color: #2563eb; margin-bottom: 15px;">S/. ${t.precio} <span style="font-size: 13px; color: #64748b; font-weight: normal;">por hora</span></p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Descripción de la clase</p>
                    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">${t.descripcion || 'Sin descripción detallada.'}</p>
                </div>

                <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-bottom: 25px; display: flex; align-items: center; gap: 14px;">
                    <div style="width: 45px; height: 45px; background: #dbeafe; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #1d4ed8; font-size: 16px;">
                        ${(tutor.full_name || 'T').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b;">${tutor.full_name || 'Tutor StudyHUB'}</p>
                        <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${tutor.career || 'Estudiante'} • ${tutor.cycle || 'Ciclo no especificado'}</p>
                    </div>
                </div>

                ${tutor.phone ? `
                    <a href="${enlaceWp}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #25d366; color: white; text-decoration: none; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3); transition: background 0.2s;">
                        <span style="font-size: 20px;">💬</span> Contactar por WhatsApp
                    </a>
                ` : `
                    <div style="background: #fef2f2; color: #991b1b; padding: 12px; border-radius: 10px; text-align: center; font-size: 13px; font-weight: 500;">
                        Este tutor aún no ha registrado un número de teléfono.
                    </div>
                `}

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('cerrar-modal-detalle').addEventListener('click', () => {
        document.getElementById('modal-detalle-tutoria').remove();
    });

    document.getElementById('modal-detalle-tutoria').addEventListener('click', (e) => {
        if (e.target.id === 'modal-detalle-tutoria') {
            e.target.remove();
        }
    });
}

const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        alert('Has cerrado sesión correctamente.');
        window.location.href = 'iniciar sesion.html';
    });
}