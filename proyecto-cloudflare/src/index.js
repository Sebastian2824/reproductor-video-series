/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Habilitar CORS - MÉTODOS ACTUALIZADOS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Rutas
	// Rutas
    if (request.method === 'GET' && pathname === '/series') {
      try {
        const result = await env.animes_plus.prepare("SELECT * FROM animes_series").all();
        return new Response(JSON.stringify(result.results), { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Ruta para obtener solo los nombres de las series
    if (request.method === 'GET' && pathname === '/nombres-series') {
      try {
        const result = await env.animes_plus.prepare("SELECT DISTINCT nombreSerie FROM animes_series").all();
        const nombresSeries = result.results.map(r => r.nombreSerie);

        return new Response(JSON.stringify(nombresSeries), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    // Obtener temporadas de una serie
    if (request.method === 'GET' && pathname === '/temporadas') {
      try {
        const nombreSerie = url.searchParams.get('serie');
        if (!nombreSerie) {
          return new Response(JSON.stringify({ error: "Falta el parámetro 'serie'" }), { status: 400, headers: corsHeaders });
        }

        const result = await env.animes_plus
          .prepare("SELECT DISTINCT temporada FROM animes_series WHERE nombreSerie = ?")
          .bind(nombreSerie)
          .all();

        const temporadas = result.results.map(r => r.temporada);

        return new Response(JSON.stringify(temporadas), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Obtener idiomas de una serie + temporada
    if (request.method === 'GET' && pathname === '/idiomas') {
      try {
        const nombreSerie = url.searchParams.get('serie');
        const temporada = url.searchParams.get('temporada');
        if (!nombreSerie || !temporada) {
          return new Response(JSON.stringify({ error: "Faltan parámetros 'serie' o 'temporada'" }), { status: 400, headers: corsHeaders });
        }

        const result = await env.animes_plus
          .prepare("SELECT DISTINCT idioma FROM animes_series WHERE nombreSerie = ? AND temporada = ?")
          .bind(nombreSerie, temporada)
          .all();

        const idiomas = result.results.map(r => r.idioma);
        return new Response(JSON.stringify(idiomas), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Obtener servidores de una serie + temporada + idioma
    if (request.method === 'GET' && pathname === '/servidores') {
      try {
        const nombreSerie = url.searchParams.get('serie');
        const temporada = url.searchParams.get('temporada');
        const idioma = url.searchParams.get('idioma');
        if (!nombreSerie || !temporada || !idioma) {
          return new Response(JSON.stringify({ error: "Faltan parámetros 'serie', 'temporada' o 'idioma'" }), { status: 400, headers: corsHeaders });
        }

        const result = await env.animes_plus
          .prepare("SELECT DISTINCT servidor FROM animes_series WHERE nombreSerie = ? AND temporada = ? AND idioma = ?")
          .bind(nombreSerie, temporada, idioma)
          .all();

        const servidores = result.results.map(r => r.servidor);
        return new Response(JSON.stringify(servidores), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Obtener episodios de una serie + temporada + idioma + servidor
    if (request.method === 'GET' && pathname === '/episodios') {
      try {
        const nombreSerie = url.searchParams.get('serie');
        const temporada = url.searchParams.get('temporada');
        const idioma = url.searchParams.get('idioma');
        const servidor = url.searchParams.get('servidor');
        if (!nombreSerie || !temporada || !idioma || !servidor) {
          return new Response(JSON.stringify({ error: "Faltan parámetros 'serie', 'temporada', 'idioma' o 'servidor'" }), { status: 400, headers: corsHeaders });
        }

        const result = await env.animes_plus
          .prepare("SELECT episodio, iframe FROM animes_series WHERE nombreSerie = ? AND temporada = ? AND idioma = ? AND servidor = ?")
          .bind(nombreSerie, temporada, idioma, servidor)
          .all();

        return new Response(JSON.stringify(result.results), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Actualizar episodio - RUTA CORREGIDA
    if (request.method === 'PUT' && pathname === '/actualizar-episodio') {
      try {
        const { serie, temporada, idioma, servidor, episodio, iframe } = await request.json();

        if (!serie || !temporada || !idioma || !servidor || !episodio || !iframe) {
          return new Response(JSON.stringify({ error: "Faltan parámetros requeridos" }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        const result = await env.animes_plus
          .prepare(`
            UPDATE animes_series
            SET iframe = ?
            WHERE nombreSerie = ? AND temporada = ? AND idioma = ? AND servidor = ? AND episodio = ?
          `)
          .bind(iframe, serie, temporada, idioma, servidor, episodio)
          .run();

        if (result.changes === 0) {
          return new Response(JSON.stringify({ error: "Episodio no encontrado" }), { 
            status: 404, 
            headers: corsHeaders 
          });
        }

        return new Response(JSON.stringify({ 
          message: "✅ Episodio actualizado correctamente",
          changes: result.changes 
        }), { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Eliminar episodio - RUTA SIMPLIFICADA
    if (request.method === 'DELETE' && pathname === '/eliminar-episodio') {
      try {
        const { serie, temporada, idioma, servidor, episodio } = await request.json();

        if (!serie || !temporada || !idioma || !servidor || !episodio) {
          return new Response(JSON.stringify({ error: "Faltan parámetros requeridos" }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        const result = await env.animes_plus
          .prepare(`
            DELETE FROM animes_series
            WHERE nombreSerie = ? AND temporada = ? AND idioma = ? AND servidor = ? AND episodio = ?
          `)
          .bind(serie, temporada, idioma, servidor, episodio)
          .run();

        if (result.changes === 0) {
          return new Response(JSON.stringify({ error: "Episodio no encontrado" }), { 
            status: 404, 
            headers: corsHeaders 
          });
        }

        return new Response(JSON.stringify({ 
          message: "✅ Episodio eliminado correctamente",
          changes: result.changes 
        }), { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Registrar nuevos episodios
    if (request.method === 'POST' && pathname === '/registrar') {
      try {
        const { registros } = await request.json();

        const stmt = env.animes_plus.prepare(`
          INSERT INTO animes_series 
          (nombreSerie, temporada, idioma, servidor, episodio, iframe)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (nombreSerie, temporada, idioma, servidor, episodio)
          DO UPDATE SET 
            iframe = excluded.iframe,
            creado_en = CURRENT_TIMESTAMP
        `);

        for (const reg of registros) {
          await stmt
            .bind(
              reg.nombreSerie,
              reg.temporada,
              reg.idioma,
              reg.servidor,
              reg.episodio,
              reg.iframe
            )
            .run();
        }

        return new Response(
          JSON.stringify({
            message: '✅ Datos guardados o actualizados correctamente en Cloudflare D1.',
            total: registros.length
          }),
          {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

	///PORTADA

// Obtener todas las portadas
if (request.method === 'GET' && pathname === '/portadas') {
  try {
    const result = await env.animes_plus.prepare("SELECT * FROM animes_series_portadas").all();
    return new Response(JSON.stringify(result.results), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Obtener portadas por serie
if (request.method === 'GET' && pathname === '/portadas-serie') {
  try {
    const nombreSerie = url.searchParams.get('serie');
    if (!nombreSerie) {
      return new Response(JSON.stringify({ error: "Falta el parámetro 'serie'" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("SELECT * FROM animes_series_portadas WHERE nombreSerie = ?")
      .bind(nombreSerie)
      .all();

    return new Response(JSON.stringify(result.results), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Obtener portada específica de serie + temporada
if (request.method === 'GET' && pathname === '/portada') {
  try {
    const nombreSerie = url.searchParams.get('serie');
    const temporada = url.searchParams.get('temporada');
    
    if (!nombreSerie || !temporada) {
      return new Response(JSON.stringify({ error: "Faltan parámetros 'serie' o 'temporada'" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("SELECT * FROM animes_series_portadas WHERE nombreSerie = ? AND temporada = ?")
      .bind(nombreSerie, temporada)
      .first();

    if (!result) {
      return new Response(JSON.stringify({ error: "Portada no encontrada" }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify(result), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Registrar o actualizar portada (equivalente al set con merge de Firebase)
if (request.method === 'POST' && pathname === '/registrar-portada') {
  try {
    const { nombreSerie, temporada, imagen, sitio, sitio02 } = await request.json();

    if (!nombreSerie || !temporada) {
      return new Response(JSON.stringify({ error: "Faltan parámetros requeridos: nombreSerie y temporada" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare(`
        INSERT INTO animes_series_portadas 
        (nombreSerie, temporada, imagen, sitio, sitio02)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (nombreSerie, temporada)
        DO UPDATE SET 
          imagen = COALESCE(excluded.imagen, imagen),
          sitio = COALESCE(excluded.sitio, sitio),
          sitio02 = COALESCE(excluded.sitio02, sitio02),
          creado_en = CURRENT_TIMESTAMP
      `)
      .bind(
        nombreSerie,
        temporada,
        imagen || null,
        sitio || null,
        sitio02 || null
      )
      .run();

    return new Response(JSON.stringify({ 
      message: "✅ Portada registrada/actualizada correctamente",
      changes: result.changes
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Actualizar portada específica
if (request.method === 'PUT' && pathname === '/actualizar-portada') {
  try {
    const { nombreSerie, temporada, imagen, sitio, sitio02 } = await request.json();

    if (!nombreSerie || !temporada) {
      return new Response(JSON.stringify({ error: "Faltan parámetros requeridos: nombreSerie y temporada" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Construir la consulta dinámicamente basada en los campos proporcionados
    let updateFields = [];
    let params = [];

    if (imagen !== undefined) {
      updateFields.push("imagen = ?");
      params.push(imagen);
    }
    if (sitio !== undefined) {
      updateFields.push("sitio = ?");
      params.push(sitio);
    }
    if (sitio02 !== undefined) {
      updateFields.push("sitio02 = ?");
      params.push(sitio02);
    }

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ error: "No hay campos para actualizar" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    updateFields.push("creado_en = CURRENT_TIMESTAMP");
    params.push(nombreSerie, temporada);

    const query = `
      UPDATE animes_series_portadas 
      SET ${updateFields.join(', ')}
      WHERE nombreSerie = ? AND temporada = ?
    `;

    const result = await env.animes_plus
      .prepare(query)
      .bind(...params)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Portada no encontrada" }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify({ 
      message: "✅ Portada actualizada correctamente",
      changes: result.changes
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Eliminar portada
if (request.method === 'DELETE' && pathname === '/eliminar-portada') {
  try {
    const { nombreSerie, temporada } = await request.json();

    if (!nombreSerie || !temporada) {
      return new Response(JSON.stringify({ error: "Faltan parámetros requeridos: nombreSerie y temporada" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("DELETE FROM animes_series_portadas WHERE nombreSerie = ? AND temporada = ?")
      .bind(nombreSerie, temporada)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Portada no encontrada" }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify({ 
      message: "✅ Portada eliminada correctamente",
      changes: result.changes
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Obtener temporadas disponibles para una serie (desde portadas)
if (request.method === 'GET' && pathname === '/temporadas-portadas') {
  try {
    const nombreSerie = url.searchParams.get('serie');
    if (!nombreSerie) {
      return new Response(JSON.stringify({ error: "Falta el parámetro 'serie'" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("SELECT DISTINCT temporada FROM animes_series_portadas WHERE nombreSerie = ? ORDER BY temporada")
      .bind(nombreSerie)
      .all();

    const temporadas = result.results.map(r => r.temporada);
    return new Response(JSON.stringify(temporadas), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

//INDICE

// Obtener todo el índice de series
if (request.method === 'GET' && pathname === '/indice-series') {
  try {
    const result = await env.animes_plus.prepare("SELECT * FROM animes_series_indice ORDER BY nombreSerie").all();
    return new Response(JSON.stringify(result.results), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Obtener serie específica del índice
if (request.method === 'GET' && pathname === '/indice-serie') {
  try {
    const nombreSerie = url.searchParams.get('serie');
    if (!nombreSerie) {
      return new Response(JSON.stringify({ error: "Falta el parámetro 'serie'" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("SELECT * FROM animes_series_indice WHERE nombreSerie = ?")
      .bind(nombreSerie)
      .first();

    if (!result) {
      return new Response(JSON.stringify({ error: "Serie no encontrada en el índice" }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify(result), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Registrar o actualizar serie en el índice (equivalente al set con merge de Firebase)
if (request.method === 'POST' && pathname === '/registrar-indice') {
  try {
    const { 
      nombreSerie, 
      nombresec, 
      nombresec02, 
      año, 
      categoria, 
      idioma, 
      imagen, 
      sitio 
    } = await request.json();

    if (!nombreSerie) {
      return new Response(JSON.stringify({ error: "Falta el parámetro requerido: nombreSerie" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare(`
        INSERT INTO animes_series_indice 
        (nombreSerie, nombresec, nombresec02, año, categoria, idioma, imagen, sitio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (nombreSerie)
        DO UPDATE SET 
          nombresec = COALESCE(excluded.nombresec, nombresec),
          nombresec02 = COALESCE(excluded.nombresec02, nombresec02),
          año = COALESCE(excluded.año, año),
          categoria = COALESCE(excluded.categoria, categoria),
          idioma = COALESCE(excluded.idioma, idioma),
          imagen = COALESCE(excluded.imagen, imagen),
          sitio = COALESCE(excluded.sitio, sitio),
          creado_en = CURRENT_TIMESTAMP
      `)
      .bind(
        nombreSerie,
        nombresec || null,
        nombresec02 || null,
        año || null,
        categoria || null,
        idioma || null,
        imagen || null,
        sitio || null
      )
      .run();

    return new Response(JSON.stringify({ 
      message: "✅ Serie registrada/actualizada correctamente en el índice",
      changes: result.changes
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Actualizar serie específica en el índice
if (request.method === 'PUT' && pathname === '/actualizar-indice') {
  try {
    const { 
      nombreSerie, 
      nombresec, 
      nombresec02, 
      año, 
      categoria, 
      idioma, 
      imagen, 
      sitio 
    } = await request.json();

    if (!nombreSerie) {
      return new Response(JSON.stringify({ error: "Falta el parámetro requerido: nombreSerie" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Construir la consulta dinámicamente basada en los campos proporcionados
    let updateFields = [];
    let params = [];

    if (nombresec !== undefined) {
      updateFields.push("nombresec = ?");
      params.push(nombresec);
    }
    if (nombresec02 !== undefined) {
      updateFields.push("nombresec02 = ?");
      params.push(nombresec02);
    }
    if (año !== undefined) {
      updateFields.push("año = ?");
      params.push(año);
    }
    if (categoria !== undefined) {
      updateFields.push("categoria = ?");
      params.push(categoria);
    }
    if (idioma !== undefined) {
      updateFields.push("idioma = ?");
      params.push(idioma);
    }
    if (imagen !== undefined) {
      updateFields.push("imagen = ?");
      params.push(imagen);
    }
    if (sitio !== undefined) {
      updateFields.push("sitio = ?");
      params.push(sitio);
    }

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ error: "No hay campos para actualizar" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    updateFields.push("creado_en = CURRENT_TIMESTAMP");
    params.push(nombreSerie);

    const query = `
      UPDATE animes_series_indice 
      SET ${updateFields.join(', ')}
      WHERE nombreSerie = ?
    `;

    const result = await env.animes_plus
      .prepare(query)
      .bind(...params)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Serie no encontrada en el índice" }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify({ 
      message: "✅ Serie actualizada correctamente en el índice",
      changes: result.changes
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Eliminar serie del índice
if (request.method === 'DELETE' && pathname === '/eliminar-indice') {
  try {
    const { nombreSerie } = await request.json();

    if (!nombreSerie) {
      return new Response(JSON.stringify({ error: "Falta el parámetro requerido: nombreSerie" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("DELETE FROM animes_series_indice WHERE nombreSerie = ?")
      .bind(nombreSerie)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Serie no encontrada en el índice" }), { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify({ 
      message: "✅ Serie eliminada correctamente del índice",
      changes: result.changes
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Buscar series en el índice
if (request.method === 'GET' && pathname === '/buscar-indice') {
  try {
    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: "Falta el parámetro de búsqueda 'q'" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare(`
        SELECT * FROM animes_series_indice 
        WHERE nombreSerie LIKE ? OR nombresec LIKE ? OR nombresec02 LIKE ? OR categoria LIKE ?
        ORDER BY nombreSerie
      `)
      .bind(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`)
      .all();

    return new Response(JSON.stringify(result.results), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Obtener series por categoría
if (request.method === 'GET' && pathname === '/indice-categoria') {
  try {
    const categoria = url.searchParams.get('categoria');
    if (!categoria) {
      return new Response(JSON.stringify({ error: "Falta el parámetro 'categoria'" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("SELECT * FROM animes_series_indice WHERE categoria = ? ORDER BY nombreSerie")
      .bind(categoria)
      .all();

    return new Response(JSON.stringify(result.results), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Obtener series por año
if (request.method === 'GET' && pathname === '/indice-año') {
  try {
    const año = url.searchParams.get('año');
    if (!año) {
      return new Response(JSON.stringify({ error: "Falta el parámetro 'año'" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const result = await env.animes_plus
      .prepare("SELECT * FROM animes_series_indice WHERE año = ? ORDER BY nombreSerie")
      .bind(año)
      .all();

    return new Response(JSON.stringify(result.results), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

    // Ruta no encontrada
    return new Response('Ruta no encontrada', { 
      status: 404, 
      headers: corsHeaders 
    });
  }
};
