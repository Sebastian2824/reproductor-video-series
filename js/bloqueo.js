 // Bloquear clic derecho
document.addEventListener("contextmenu", function (event) {
    event.preventDefault();
});

// Bloquear herramientas de desarrollador
document.addEventListener("keydown", function (event) {

    // F12
    if (event.key === "F12" || event.keyCode === 123) {
        event.preventDefault();
        return false;
    }

    // Ctrl + U (Ver código fuente)
    if (event.ctrlKey && event.key.toUpperCase() === "U") {
        event.preventDefault();
        return false;
    }

    // Ctrl + Shift + I (Inspeccionar)
    if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === "I") {
        event.preventDefault();
        return false;
    }

    // Ctrl + Shift + J (Consola)
    if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === "J") {
        event.preventDefault();
        return false;
    }

    // Ctrl + Shift + C (Selector de elementos)
    if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === "C") {
        event.preventDefault();
        return false;
    }

});