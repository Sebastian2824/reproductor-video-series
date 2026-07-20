// ================= CONFIGURACIÓN DE FIREBASE =================
    const firebaseConfig = {
      apiKey: "AIzaSyB6MY2y5uyum87PdUHUpY8NNh4D73Yhx4U",
      authDomain: "animes-plus-89b93.firebaseapp.com",
      projectId: "animes-plus-89b93",
      storageBucket: "animes-plus-89b93.appspot.com",
      messagingSenderId: "402867181985",
      appId: "1:402867181985:web:d695b12977fe4270dbd3e0",
      measurementId: "G-DN632G7XJT"
    };

    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // ================= INICIO DE SESIÓN =================
    window.onload = () => {
      document.querySelector('.login-btn').addEventListener('click', async () => {
        const correo = document.getElementById('correo').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!correo || !password) {
          alert("Por favor completa todos los campos.");
          return;
        }

        try {
          const snapshot = await db.collection('usuarios')
            .where('correo', '==', correo)
            .where('contraseña', '==', password)
            .get();

          if (!snapshot.empty) {
            alert("Inicio de sesión exitoso");
            const userId = snapshot.docs[0].id;
            localStorage.setItem("usuarioId", userId);
            window.location.href = "Menu-Principal.html";
          } else {
            alert("Correo o contraseña incorrectos.");
          }
        } catch (error) {
          console.error("Error al iniciar sesión:", error);
          alert("Error al iniciar sesión. Inténtalo más tarde.");
        }
      });
    };

    // ================= RECUPERACIÓN DE CONTRASEÑA =================
    document.querySelector('.forgot-password a').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('ventana-recuperacion').style.display = 'flex';
    });

    document.getElementById('btn-actualizar-password').addEventListener('click', async () => {
      const correo = document.getElementById('recuperar-correo').value.trim();
      const fecha = document.getElementById('recuperar-fecha').value.trim();
      const nuevaPassword = document.getElementById('nueva-password').value.trim();

      if (!correo || !fecha || !nuevaPassword) {
        alert("Por favor completa todos los campos.");
        return;
      }

      try {
        const snapshot = await db.collection('usuarios')
          .where('correo', '==', correo)
          .where('fechaNacimiento', '==', fecha)
          .get();

        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          await docRef.update({ contraseña: nuevaPassword });
          alert("Contraseña actualizada correctamente. Ahora puedes iniciar sesión.");
          document.getElementById('ventana-recuperacion').style.display = 'none';
          location.reload();
        } else {
          alert("Datos incorrectos. Verifica tu correo y fecha de nacimiento.");
        }
      } catch (error) {
        console.error("Error al actualizar contraseña:", error);
        alert("Hubo un error. Inténtalo más tarde.");
      }
    });