// Limpieza del texto de los mensajes antes de publicarlos.
//
// Dos cosas que en Discord se ven mal y que es fácil escribir sin querer:
//
//   · «@usuario», «@nuevo-miembro», «@miembro»: se escriben creyendo que son
//     un marcador. Se cambian por la variable de verdad, {user}, y en Discord
//     sale la mención de la persona.
//   · «# Título» o «-# nota» en el título, el autor o el pie de un embed
//     clásico: ahí Discord no agranda ni achica nada y enseña el «#» tal cual.

const LITERAL_USER = /(^|[\s(¡¿"'«*_~>])@(usuario|user|miembro|member|nuevo[-_ ]?miembro|new[-_ ]?member|nombre)(?![\w-])/giu;
const LITERAL_SERVER = /(^|[\s(¡¿"'«*_~>])@(servidor|server)(?![\w-])/giu;

function literalPlaceholders(text) {
  return String(text ?? '')
    .replace(LITERAL_USER, (_, before) => `${before}{user}`)
    .replace(LITERAL_SERVER, (_, before) => `${before}{server}`);
}

// Una línea del embed clásico (título, autor o pie). En el autor y el pie
// tampoco funcionan la negrita, la cursiva ni el tachado: se quitan sus marcas
// para que no salgan asteriscos sueltos.
function classicLine(text, { plain = false } = {}) {
  if (text === null || text === undefined) return null;
  let line = String(text).split('\n').map(part => part.replace(/^\s*(?:-#|#{1,3})\s+/, '')).join(plain ? ' ' : '\n');
  if (plain) line = line.replace(/\*\*|__|~~|\|\||`/g, '').replace(/(^|\s)\*(\S[^*]*\S|\S)\*(?=\s|$)/g, '$1$2');
  line = line.trim();
  return line || null;
}

module.exports = { literalPlaceholders, classicLine };
