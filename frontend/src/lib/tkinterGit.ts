export const TKINTER_GIT_TITULO = "ACTIVIDAD TKINTER EN GIT";
export const TKINTER_GIT_MINUTOS = 60;
export const TKINTER_GIT_FIRMAS = 1000;

export const TKINTER_GIT_NOTA_REPO = {
  code: "repo",
  label: "No está el proyecto en GitHub",
  points: 500,
};

export const TKINTER_GIT_NOTAS = [
  TKINTER_GIT_NOTA_REPO,
  { code: "clone", label: "Alguien no clonó o no tiene commit", points: 250 },
  { code: "usuario", label: "El commit está a nombre de otra persona", points: 250 },
  { code: "abre", label: "El programa no abre", points: 250 },
  { code: "cambio", label: "No hizo el cambio que le toca", points: 250 },
];

export type TkinterPrograma = {
  titulo: string;
  ventana: string;
  pedido: string[];
};

export const TKINTER_PROGRAMAS: TkinterPrograma[] = [
  {
    titulo: "Tablas de multiplicar del 1 al 10",
    ventana: "Tablas del 1 al 10",
    pedido: [
      "Una caja para escribir un número.",
      "Un botón que diga Ver tabla.",
      "Al pulsarlo, un recuadro muestra desde 1 × n hasta 10 × n, con el resultado.",
      "Si el número no está entre 1 y 10, se lee un aviso y no se muestra la tabla.",
    ],
  },
  {
    titulo: "Conversor de Celsius a Fahrenheit",
    ventana: "Celsius a Fahrenheit",
    pedido: [
      "Una caja para los grados Celsius.",
      "Un botón Convertir.",
      "La etiqueta del resultado usa F = C × 9 / 5 + 32.",
      "Si la caja está vacía o no es un número, se lee un aviso.",
    ],
  },
  {
    titulo: "Promedio de 4 calificaciones",
    ventana: "Promedio",
    pedido: [
      "Cuatro cajas, una por calificación.",
      "Un botón Promedio.",
      "Muestra el promedio con un decimal.",
      "Si falta una caja o hay un texto que no es número, se lee cuál falta.",
    ],
  },
  {
    titulo: "Lista de pendientes",
    ventana: "Pendientes",
    pedido: [
      "Una caja para escribir una tarea y un botón Agregar.",
      "La tarea aparece en una lista.",
      "Un botón Quitar borra solo la tarea seleccionada.",
      "Si la caja está vacía, Agregar no mete una línea en blanco y muestra un aviso.",
    ],
  },
  {
    titulo: "Contador",
    ventana: "Contador",
    pedido: [
      "Una etiqueta grande empieza en 0.",
      "Un botón +1 sube el número.",
      "Un botón -1 lo baja.",
      "Un botón Reiniciar lo regresa a 0.",
    ],
  },
  {
    titulo: "Metros a centímetros",
    ventana: "Metros a centímetros",
    pedido: [
      "Una caja para los metros.",
      "Un botón Convertir.",
      "Muestra los centímetros: metros × 100.",
      "Si la caja está vacía o no es un número, se lee un aviso.",
    ],
  },
  {
    titulo: "Ficha del alumno",
    ventana: "Ficha del alumno",
    pedido: [
      "Tres cajas: nombre, grupo y número de lista.",
      "Un botón Mostrar ficha.",
      "Un recuadro arma el texto: Alumno, grupo y número de lista.",
      "Si falta un dato, dice cuál caja está vacía.",
    ],
  },
  {
    titulo: "Cuadrados del 1 al 20",
    ventana: "Cuadrados",
    pedido: [
      "Un botón Mostrar cuadrados.",
      "Un recuadro lista del 1 al 20: el número, la palabra al cuadrado y el resultado.",
      "Ejemplo de la primera línea: 1 al cuadrado es 1.",
      "La última línea es: 20 al cuadrado es 400.",
    ],
  },
  {
    titulo: "Propina",
    ventana: "Propina",
    pedido: [
      "Una caja para el total de la cuenta y otra para el porcentaje de propina.",
      "Un botón Calcular.",
      "Muestra la propina y el total a pagar.",
      "Si falta un dato o no es un número, se lee un aviso.",
    ],
  },
  {
    titulo: "Precio con descuento",
    ventana: "Descuento",
    pedido: [
      "Una caja para el precio y otra para el porcentaje de descuento.",
      "Un botón Calcular.",
      "Muestra cuánto se descuenta y cuánto se paga.",
      "Si el descuento es menor que 0 o mayor que 100, se lee un aviso.",
    ],
  },
  {
    titulo: "Adivina el número",
    ventana: "Adivina el número",
    pedido: [
      "Al abrir, el programa piensa un número del 1 al 20.",
      "Una caja y un botón Probar.",
      "Dice muy alto, muy bajo o le atinaste.",
      "Un botón Otro número piensa uno nuevo y limpia la caja.",
    ],
  },
  {
    titulo: "Total de 3 productos",
    ventana: "Total de productos",
    pedido: [
      "Tres cajas de nombre y tres cajas de precio.",
      "Un botón Total.",
      "Muestra cada producto y, al final, la suma de los tres precios.",
      "Si falta un precio o no es un número, se lee un aviso.",
    ],
  },
];

export type TkinterMiembro = {
  id: string;
  displayName: string;
  listNumber: number | null;
  isLeader: boolean;
};

export const TKINTER_GIT_REQUISITOS = [
  "El programa trata del tema que le tocó al equipo. La ventana, las cajas y los botones sirven para ese tema.",
  "El equipo crea una base de datos para guardar los datos que genere la aplicación.",
  "En programa.py va la cadena de conexión a esa base.",
  "En ese mismo archivo va la aplicación de Tkinter que resuelve el problema.",
  "La aplicación hace el CRUD: guardar, consultar, actualizar y eliminar esos datos en la base.",
  "Cada integrante participa en algo. Arriba de su cambio deja un comentario con su nombre y lo que hizo.",
  "El commit lleva el nombre del cambio y el nombre del integrante.",
];

export const TKINTER_GIT_PDF_MAX_BYTES = 8 * 1024 * 1024;
export const TKINTER_GIT_INSTRUCTIVO = "/instructivo-tkinter-git.pdf";

export type TkinterGitResponse = {
  groupCode: string;
  released?: boolean;
  myTeamId?: string | null;
  teams: TkinterEquipo[];
};

export type TkinterEquipo = {
  id: string;
  name: string;
  leaderId: string | null;
  members: TkinterMiembro[];
};

export type CambioGit = {
  titulo: string;
  detalle: string;
  commit: string;
};

const CAMBIO_LIDER: CambioGit = {
  titulo: "Sube el programa inicial",
  detalle:
    "Crea la base de datos y programa.py. En el archivo van la cadena de conexión, la aplicación de Tkinter del problema del equipo y el CRUD. Arriba de tu parte deja un comentario con tu nombre. Luego súbelo a GitHub.",
  commit: "Subo el programa inicial",
};

const CAMBIOS_DEMAS: CambioGit[] = [
  {
    titulo: "Colores y nombre del equipo",
    detalle:
      "Cambia el color de fondo de la ventana y el color de los botones. El título de la ventana debe incluir el nombre del equipo.",
    commit: "Cambio colores y titulo del equipo",
  },
  {
    titulo: "Aviso si faltan datos",
    detalle:
      "Si una caja necesaria está vacía, una etiqueta en rojo dice qué falta. El programa no calcula hasta que el dato esté escrito.",
    commit: "Agrego el aviso si faltan datos",
  },
  {
    titulo: "Botón Limpiar",
    detalle: "Agrega un botón Limpiar. Al pulsarlo, las cajas quedan vacías y desaparece el resultado.",
    commit: "Agrego el boton Limpiar",
  },
  {
    titulo: "Nombres del equipo",
    detalle: "Agrega una etiqueta hasta abajo con el nombre de cada integrante del equipo.",
    commit: "Agrego los nombres del equipo",
  },
  {
    titulo: "Tamaño de la ventana",
    detalle: "La ventana abre en 480 por 360. No se puede encoger por debajo de ese tamaño.",
    commit: "Ajusto el tamano de la ventana",
  },
];

const CAMBIO_EXTRA: CambioGit = {
  titulo: "Tu nombre en el programa",
  detalle:
    "Agrega tu nombre en la etiqueta de abajo. Si el botón principal se lee poco, cambia su texto para que se entienda.",
  commit: "Dejo mi nombre en el programa",
};

export function programaDelEquipo(teams: Array<{ id: string }>, teamId: string, groupCode?: string | null) {
  const index = teams.findIndex((team) => team.id === teamId);
  if (index < 0 || TKINTER_PROGRAMAS.length === 0) return null;
  const offset = groupCode?.trim() === "302" ? 6 : 0;
  return TKINTER_PROGRAMAS[(index + offset) % TKINTER_PROGRAMAS.length];
}

export function cambioDe(members: TkinterMiembro[], studentId: string): CambioGit | null {
  const leader = members.find((member) => member.isLeader) ?? members[0];
  if (!leader) return null;
  if (studentId === leader.id) return CAMBIO_LIDER;
  const resto = members.filter((member) => member.id !== leader.id);
  const index = resto.findIndex((member) => member.id === studentId);
  if (index < 0) return null;
  return CAMBIOS_DEMAS[index] ?? CAMBIO_EXTRA;
}

export function cambiosDelEquipo(members: TkinterMiembro[]) {
  const leader = members.find((member) => member.isLeader) ?? members[0];
  const resto = members.filter((member) => member.id !== leader?.id);
  return members.map((member) => ({
    member,
    cambio: member.id === leader?.id ? CAMBIO_LIDER : (CAMBIOS_DEMAS[resto.findIndex((item) => item.id === member.id)] ?? CAMBIO_EXTRA),
  }));
}

export function nombreRepositorio(groupCode: string, teamName: string) {
  const slug = teamName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `tkinter-${groupCode}-${slug || "equipo"}`;
}

export type GitPaso = { quien: string; titulo: string; lineas: string[]; comandos?: string[] };

export function pasosGit(repo: string): GitPaso[] {
  return [
    {
      quien: "Todos",
      titulo: "Instala Git si la computadora no lo tiene",
      lineas: [
        "Abre la carpeta donde vas a trabajar. Haz clic en la barra de la dirección, escribe powershell y pulsa Enter.",
        "Escribe el comando de abajo y pulsa Enter.",
        "Si aparece un número, por ejemplo git version 2.45.0, Git ya está. Sigue al paso del usuario.",
        "Si dice que git no se reconoce, entra a https://git-scm.com/download/win y baja Git para Windows.",
        "En el instalador pulsa Next hasta el final. En la pantalla de PATH deja la opción que dice Git from the command line.",
        "Al terminar, cierra esa ventana negra y ábrela otra vez en la misma carpeta. Vuelve a probar git --version.",
      ],
      comandos: ["git --version"],
    },
    {
      quien: "Todos, en cada computadora",
      titulo: "Revisa si Git está a tu nombre",
      lineas: [
        "Esto se hace antes de guardar cualquier cambio. Si la computadora la usó otra persona, el commit puede salir con el nombre de ella.",
        "Escribe estos dos comandos, uno por uno.",
        "Lee lo que contesta. Tiene que ser tu nombre y el correo con el que creaste tu cuenta de GitHub.",
        "Para ver tu correo: en GitHub pulsa tu foto, Settings, y luego Emails. Usa el que aparece ahí.",
      ],
      comandos: ["git config --global user.name", "git config --global user.email"],
    },
    {
      quien: "Todos, solo si el nombre no es el tuyo",
      titulo: "Cambia el usuario en esta carpeta",
      lineas: [
        "Primero entra a la carpeta del proyecto. El líder la crea en el paso siguiente. Quien clona entra después de clonar.",
        "Estas dos líneas cambian el nombre solo dentro de esta carpeta. Las demás tareas de la computadora siguen igual.",
        "Cambia el texto de las comillas por tu nombre y por tu correo. Quita el ejemplo Ana Lopez.",
        "Vuelve a preguntar el nombre. Ahora tiene que salir el tuyo.",
        "Si sigue saliendo otra persona, no estás en la carpeta del proyecto. Escribe cd y pulsa Enter. La ruta debe terminar en el nombre del repositorio.",
      ],
      comandos: [
        'git config user.name "Ana Lopez"',
        'git config user.email "ana.lopez@gmail.com"',
        "git config user.name",
        "git config user.email",
      ],
    },
    {
      quien: "El líder",
      titulo: "Crea el proyecto vacío en GitHub",
      lineas: [
        "Entra a github.com con tu cuenta.",
        "Junto a tu foto pulsa el signo + y elige New repository.",
        "En Repository name escribe exactamente el nombre de abajo.",
        "Marca Public.",
        "Deja sin marcar Add a README. Si lo marcas, el primer envío se atasca.",
        "Pulsa el botón verde Create repository.",
        "Deja abierta la página. Ahí está la dirección que van a usar los demás.",
      ],
      comandos: [repo],
    },
    {
      quien: "El líder",
      titulo: "Invita a los compañeros",
      lineas: [
        "En el repositorio pulsa Settings.",
        "En el menú izquierdo busca Collaborators. Si no está, pulsa Access y ahí aparece.",
        "Pulsa Add people.",
        "Escribe el usuario de GitHub de un compañero, el nombre que va después de github.com/, y pulsa Add.",
        "Repite con cada integrante y con el docente.",
        "Cada compañero entra a GitHub con su cuenta, abre la campana y pulsa Accept invitation.",
      ],
    },
    {
      quien: "El líder",
      titulo: "Guarda programa.py en una carpeta nueva",
      lineas: [
        "En la terminal escribe estos comandos. Crean la carpeta en Documentos y entran en ella.",
        "Abre Python, escribe el programa del equipo y guárdalo con Archivo, Guardar como.",
        "Elige esa misma carpeta. El nombre del archivo es exactamente programa.py.",
        "Cierra el cuadro de guardar. El archivo tiene que estar dentro de la carpeta, no en el escritorio.",
      ],
      comandos: ["cd $env:USERPROFILE\\Documents", `mkdir ${repo}`, `cd ${repo}`],
    },
    {
      quien: "El líder",
      titulo: "Sube el programa a la rama main",
      lineas: [
        "Sigue en la misma ventana negra, dentro de la carpeta. Si hace falta, cambia tu usuario con el paso de arriba.",
        "Los comandos van uno por uno. Espera a que termine cada uno.",
        "git status debe mostrar programa.py en rojo antes del commit, y después decir working tree clean.",
        "En remote add pega tu usuario de GitHub en lugar de TU-USUARIO. La dirección es la de la página del repositorio, con .git al final.",
        "En el push se abre una ventana para entrar a GitHub. Entra con tu cuenta.",
        "Si la ventana negra pide Password, no escribas la contraseña de GitHub. Ciérrala y deja que se abra el navegador. GitHub ya no acepta esa contraseña en la terminal.",
        "Al terminar, recarga la página del repositorio. Debe verse programa.py.",
      ],
      comandos: [
        "git init",
        "git branch -M main",
        "git add programa.py",
        "git status",
        'git commit -m "Subo el programa inicial - Ana Lopez"',
        "git status",
        `git remote add origin https://github.com/TU-USUARIO/${repo}.git`,
        "git push -u origin main",
      ],
    },
    {
      quien: "El líder",
      titulo: "Pasa la dirección a los demás",
      lineas: [
        "En GitHub pulsa el botón verde Code.",
        "Elige HTTPS.",
        "Pulsa el ícono de copiar.",
        "Pega esa dirección en el chat del equipo. Todos clonan esa misma dirección, no escriban una parecida.",
      ],
    },
    {
      quien: "Cada compañero",
      titulo: "Clona el proyecto",
      lineas: [
        "Primero acepta la invitación en GitHub. Si no la aceptas, el clone puede pedir permiso y no entrar.",
        "Abre PowerShell en Documentos con los comandos de abajo.",
        "En git clone pega la dirección que copió el líder, entre comillas si trae algún espacio.",
        "Luego entra a la carpeta. El nombre es el del repositorio.",
        "Abre programa.py desde esa carpeta y pruébalo. Tiene que ser el programa del equipo, no uno nuevo.",
      ],
      comandos: ["cd $env:USERPROFILE\\Documents", `git clone https://github.com/USUARIO-DEL-LIDER/${repo}.git`, `cd ${repo}`],
    },
    {
      quien: "Cada compañero",
      titulo: "Pon tu usuario antes de cambiar el programa",
      lineas: [
        "Ya estás dentro de la carpeta clonada. Pregunta el nombre.",
        "Si no es el tuyo, cámbialo con tu nombre y tu correo, como en el paso de cambio de usuario.",
        "Vuelve a preguntar. Tiene que salir tu nombre antes de seguir.",
      ],
      comandos: ["git config user.name", "git config user.email"],
    },
    {
      quien: "Cada compañero, de uno en uno",
      titulo: "Baja la rama, haz tu cambio y súbelo",
      lineas: [
        "La rama se llama main. Todos suben ahí. origin es el proyecto de GitHub.",
        "Entra una sola persona a la vez. Si dos editan juntos, los cambios se pisan.",
        "Antes de tocar el archivo, baja lo último con git pull.",
        "Abre programa.py y haz el cambio que te toca.",
        "Justo arriba de ese cambio escribe un comentario con tu nombre y lo que hiciste. Ejemplo: # Ana Lopez: agrego el boton Limpiar.",
        "En el commit van el nombre del cambio y tu nombre. Cambia Ana Lopez por el tuyo.",
        "git status al final debe decir working tree clean.",
        "Recarga GitHub. Tu usuario debe aparecer junto al último cambio de programa.py.",
      ],
      comandos: [
        "git pull origin main",
        "git add programa.py",
        'git commit -m "Agrego el boton Limpiar - Ana Lopez"',
        "git push origin main",
        "git status",
      ],
    },
    {
      quien: "Si el push no entra",
      titulo: "Alguien subió antes que tú",
      lineas: [
        "Si dice rejected o failed to push, otra persona alcanzó a subir.",
        "Baja sus cambios y vuelve a subir. El --no-edit evita que se abra un editor.",
        "Si aun así se abre un editor raro, escribe :wq y pulsa Enter. Luego repite el push.",
        "Después abre el programa y revisa que tu cambio siga ahí.",
      ],
      comandos: ["git pull origin main --no-edit", "git push origin main"],
    },
    {
      quien: "Un integrante",
      titulo: "Sube el PDF del equipo",
      lineas: [
        "El PDF es la evidencia. Lo sube un solo integrante, de preferencia el líder.",
        "La portada dice de qué trata el programa y trae el enlace del repositorio.",
        "Después se ven la base de datos, la cadena de conexión y el CRUD funcionando en Tkinter.",
        "También se ve el comentario de cada integrante dentro de programa.py.",
        "Es un solo PDF y pesa 8 MB o menos. Si lo vuelven a subir, reemplaza el anterior.",
      ],
    },
  ];
}
