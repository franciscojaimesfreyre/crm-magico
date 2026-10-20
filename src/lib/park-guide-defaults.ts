// Fichas base de parques y eventos especiales, armadas a partir de los itinerarios de ejemplo del
// equipo. Se cargan desde el catálogo ("Cargar fichas base") y después las mantiene el admin; los
// horarios son de referencia (varían según la fecha).
import type { SectionKind } from "@/lib/park-sheet";
import type { Destination } from "@/generated/prisma/enums";

type I = [name: string, detail?: string, time?: string];
type S = { kind: SectionKind; title?: string; items: I[]; note?: string };

export type DefaultGuide = {
  kind: "PARK" | "EVENT";
  destination: Destination;
  name: string;
  park?: string;
  aliases: string[];
  openTime?: string;
  closeTime?: string;
  hoursNote?: string;
  arrival?: string;
  mainShow?: string;
  sections: S[];
};

const HOURS_NOTE = "Horarios de referencia: cambian según la fecha. Revisar la app el día anterior.";
const QUICK_TIP = "Usar la app para pedir la comida y elegir la hora de retiro en los quick service.";

export const DEFAULT_GUIDES: DefaultGuide[] = [
  // ─── Walt Disney World ─────────────────────────────────────────────────────
  {
    kind: "PARK",
    destination: "DISNEY_WORLD",
    name: "Magic Kingdom",
    aliases: ["MK", "Magic"],
    openTime: "09:00",
    closeTime: "22:00",
    hoursNote: HOURS_NOTE,
    arrival: "30 a 45 min antes de la apertura",
    mainShow: "Happily Ever After",
    sections: [
      {
        kind: "MUST_DO",
        items: [
          ["TRON Lightcycle / Run", "Montaña rusa intensa"],
          ["Seven Dwarfs Mine Train", "Montaña rusa intermedia"],
          ["Tiana's Bayou Adventure", "Paseo con caída"],
          ["Big Thunder Mountain Railroad", "Montaña rusa intermedia"],
        ],
      },
      {
        kind: "CLASSICS",
        title: "Clásicos de Magic Kingdom",
        items: [
          ["Haunted Mansion", "Paseo de terror"],
          ["Pirates of the Caribbean", "Paseo familiar"],
          ["Peter Pan's Flight", "Paseo familiar"],
          ["Space Mountain", "Montaña rusa intermedia"],
        ],
      },
      {
        kind: "MILD",
        items: [
          ["It's a Small World"],
          ["The Magic Carpets of Aladdin y Dumbo"],
          ["Mickey's PhilharMagic"],
          ["Buzz Lightyear's Space Ranger Spin", "Renovado"],
          ["Enchanted Tales with Belle"],
          ["Under the Sea: Journey of The Little Mermaid"],
          ["Mad Tea Party", "Tazas giratorias"],
          ["Jungle Cruise"],
        ],
      },
      {
        kind: "SHOWS",
        title: "Shows y desfiles importantes",
        items: [
          ["Disney Adventure Friends Cavalcade", "", "11:05"],
          ["Festival of Fantasy Parade", "", "14:00"],
          ["Disney Starlight: Dream the Night Away", "Desfile nocturno, ¡nuevo!", "20:15 y 22:30"],
          ["Happily Ever After", "Fuegos artificiales frente al castillo", "21:30"],
        ],
        note: "Llegar 30 a 45 min antes del show para conseguir un buen lugar.",
      },
      {
        kind: "CHARACTERS",
        items: [
          ["Mickey", "Town Square Theater (entrada a la derecha)"],
          ["Princesas", "Princess Fairytale Hall, en Fantasyland"],
          ["Jazmín y Aladdín", "Adventureland, en Agrabah (junto a las alfombras)"],
          ["Goofy, Donald y Minnie", "Pete's Silly Sideshow, en Fantasyland"],
          ["Ariel", "En su gruta, en Fantasyland"],
        ],
      },
      {
        kind: "DINING",
        title: "Dónde comer (quick service)",
        items: [
          ["Casey's Corner", "Main Street · Hot dogs gigantes, un clásico"],
          ["Columbia Harbour House", "Liberty Square · Mariscos y opciones saludables"],
          ["Pecos Bill Tall Tale Inn and Cafe", "Frontierland · Tex-mex abundante"],
          ["Cosmic Ray's Starlight Café", "Tomorrowland · Mucha variedad y toppings"],
        ],
        note: QUICK_TIP,
      },
      {
        kind: "SNACKS",
        items: [
          ["Mickey Pretzel", "Para compartir · En los carritos de todo el parque"],
          ["Mickey Ice Cream Bar", "Helado con forma de Mickey · En los carritos"],
          ["Waffle con fruta y chocolate", "Sleepy Hollow"],
          ["Funnel Cake", "Súper abundante · Sleepy Hollow"],
          ["Roll de canela gigante", "Gaston's Tavern"],
        ],
      },
      {
        kind: "TIPS",
        items: [
          ["Arrancar por Fantasyland: a la mañana suele tener menos gente."],
          ["Usar la app My Disney todo el día para ver los tiempos de espera."],
          ["Llevar botella y pedir agua gratis en los restaurantes."],
          ["Hacer TRON a la noche, con las luces encendidas."],
          ["Llevar ponchos por si llueve y para Tiana's Bayou Adventure."],
          ["Las noches de fiesta (Halloween o Navidad) el parque cierra antes para el público general."],
        ],
      },
    ],
  },
  {
    kind: "PARK",
    destination: "DISNEY_WORLD",
    name: "EPCOT",
    aliases: [],
    openTime: "09:00",
    closeTime: "21:00",
    hoursNote: HOURS_NOTE,
    arrival: "30 min antes de la apertura",
    mainShow: "Luminous: The Symphony of Us · 21:00",
    sections: [
      {
        kind: "MUST_DO",
        items: [
          ["Guardians of the Galaxy: Cosmic Rewind", "Montaña rusa intensa"],
          ["Test Track", "Simulador de velocidad"],
          ["Soarin' Around the World", "Simulador de ala delta"],
          ["Mission: SPACE", "Simulador espacial"],
        ],
      },
      {
        kind: "MILD",
        items: [
          ["Frozen Ever After"],
          ["Remy's Ratatouille Adventure"],
          ["Gran Fiesta Tour", "México"],
          ["Journey of Water, Inspired by Moana"],
          ["Spaceship Earth"],
          ["Living with the Land"],
          ["The American Adventure"],
          ["Canada Far and Wide"],
          ["Journey Into Imagination with Figment"],
          ["Reflections of China"],
          ["SeaBase Aquarium"],
          ["Turtle Talk with Crush"],
        ],
      },
      {
        kind: "CHARACTERS",
        title: "Personajes en EPCOT",
        items: [
          ["Mickey y amigos", "En la entrada"],
          ["Alicia", "Reino Unido"],
          ["Jazmín", "Marruecos"],
          ["Anna y Elsa", "Noruega"],
          ["Blancanieves", "Alemania"],
          ["Bella o Aurora", "Francia"],
          ["Donald", "México"],
          ["Mulán", "China"],
          ["Star-Lord", "Guardianes de la Galaxia"],
        ],
        note: "Chequear siempre la app para ver los horarios y qué personajes están.",
      },
      {
        kind: "DINING",
        title: "Dónde comer (quick service)",
        items: [
          ["Les Halles Boulangerie-Patisserie", "Francia · Pastelería francesa"],
          ["Sunshine Seasons", "The Land · Opciones clásicas"],
          ["Spice Road Table", "Marruecos · Tapas mediterráneas"],
          ["Katsura Grill", "Japón · Bowls de pollo teriyaki"],
          ["Regal Eagle Smokehouse", "Estados Unidos · Comida americana"],
          ["Lotus Blossom Café", "China · Buenas opciones rápidas"],
        ],
        note: QUICK_TIP,
      },
      {
        kind: "SNACKS",
        items: [
          ["School Bread", "Kringla Bakeri og Kafe · Noruega"],
          ["Pork Egg Roll", "Joy of Tea · China"],
          ["Nachos con guacamole y margaritas", "México"],
          ["Crepes dulces", "Crêperie de Paris · Francia"],
          ["Pretzel Bread Pudding", "Sommerfest · Alemania"],
        ],
      },
      {
        kind: "TIPS",
        items: [
          ["Arrancar por Guardians of the Galaxy o por Remy."],
          ["Para cruzar entre pabellones se puede tomar el barquito."],
          ["Llevar botella y pedir agua gratis en los restaurantes."],
          ["Probar snacks de los distintos países (y de los puestos del festival si hay uno)."],
          ["Ir a Club Cool a probar las Coca-Colas del mundo."],
          ["Entrar a las tiendas de los pabellones: tienen merch única."],
          ["Ubicarse con tiempo en Italia o Estados Unidos para ver el show de cierre."],
        ],
      },
    ],
  },
  {
    kind: "PARK",
    destination: "DISNEY_WORLD",
    name: "Hollywood Studios",
    aliases: ["HS", "Disney's Hollywood Studios"],
    openTime: "09:00",
    closeTime: "21:00",
    hoursNote: HOURS_NOTE,
    arrival: "30 a 45 min antes de la apertura",
    mainShow: "Fantasmic! · 20:30",
    sections: [
      {
        kind: "MUST_DO",
        items: [
          ["The Twilight Zone Tower of Terror", "Caída intensa"],
          ["Star Wars: Rise of the Resistance", "Simulador"],
          ["Millennium Falcon: Smugglers Run", "Simulador de vuelo"],
          ["Slinky Dog Dash", "Montaña rusa intermedia"],
          ["Rock 'n' Roller Coaster", "Montaña rusa intensa"],
        ],
      },
      {
        kind: "MILD",
        title: "Atracciones leves y shows",
        items: [
          ["Toy Story Mania!"],
          ["Mickey & Minnie's Runaway Railway"],
          ["Star Tours: The Adventures Continue"],
          ["Alien Swirling Saucers"],
          ["Walt Disney Presents"],
          ["Encuentro con Darth Vader"],
          ["Wonderful World of Animation"],
          ["Green Army Men", "Los soldaditos verdes de Toy Story"],
        ],
      },
      {
        kind: "SHOWS",
        title: "Shows imperdibles",
        items: [
          ["Disney Villains: Unfairly Ever After", "¡Nuevo!", "Varias funciones"],
          ["The Little Mermaid: A Musical Adventure", "¡Nuevo!", "Varias funciones"],
          ["For the First Time in Forever: A Frozen Sing-Along", "", "Varias funciones"],
          ["Beauty and the Beast: Live on Stage", "", "Varias funciones"],
          ["Indiana Jones Epic Stunt Spectacular", "", "Varias funciones"],
          ["Fantasmic!", "Legendario", "20:30"],
        ],
      },
      {
        kind: "CHARACTERS",
        title: "Personajes en Hollywood Studios",
        items: [
          ["Mickey y Minnie", "Red Carpet Dreams (Mickey con traje de Fantasía)"],
          ["Mando, Darth Vader, Kylo Ren, Rey, Chewbacca y stormtroopers", "Galaxy's Edge"],
          ["Sulley, Edna Moda y Frozono", "Pixar Place"],
          ["Woody, Buzz, Jessie y los soldaditos", "Toy Story Land"],
          ["Olaf", "Echo Lake"],
        ],
      },
      {
        kind: "DINING",
        title: "Dónde comer (quick service)",
        items: [
          ["Docking Bay 7 Food and Cargo", "Star Wars · Muy bueno e inmersivo"],
          ["Ronto Roasters", "Star Wars · Los famosos Ronto Wraps"],
          ["Woody's Lunch Box", "Pop-tarts caseras y grilled cheese"],
          ["ABC Commissary", "Opciones americanas variadas y baratas"],
          ["Fairfax Fare", "Waffles rellenos y papas con toppings"],
          ["The Trolley Car Café", "Starbucks · Ideal para llevar algo a Fantasmic!"],
        ],
        note: QUICK_TIP,
      },
      {
        kind: "SNACKS",
        items: [
          ["Totchos", "Tater tots con queso y carne · Woody's Lunch Box"],
          ["Ronto Wrap", "Ronto Roasters"],
          ["Galletas Num Num de Jack-Jack", "Pixar Place"],
          ["Carrot Cake Whoopie Pie", "The Trolley Car Café"],
        ],
      },
      {
        kind: "TIPS",
        items: [
          ["Usar la app My Disney todo el tiempo para ver las esperas."],
          ["Arrancar por Star Wars o por Sunset Boulevard."],
          ["Comer en Star Wars o en Toy Story Land."],
          ["Reservar con tiempo los table service."],
          ["No perderse Fantasmic! por las proyecciones."],
          ["Para pasear, tomar el Skyliner a Disney Springs o a conocer otro hotel."],
          ["Recorrer las tiendas de Hollywood Boulevard, a la entrada."],
        ],
      },
    ],
  },
  {
    kind: "PARK",
    destination: "DISNEY_WORLD",
    name: "Animal Kingdom",
    aliases: ["AK", "Disney's Animal Kingdom"],
    openTime: "08:00",
    closeTime: "19:00",
    hoursNote: HOURS_NOTE,
    arrival: "30 min antes de la apertura",
    mainShow: "Festival of the Lion King · Varias funciones",
    sections: [
      {
        kind: "MUST_DO",
        items: [
          ["Kilimanjaro Safaris", "Safari en camión"],
          ["Avatar Flight of Passage", "Simulador"],
          ["Expedition Everest", "Montaña rusa intensa"],
        ],
        note: "Para Avatar conviene el Lightning Lane Single Pass; el Multi Pass no hace falta.",
      },
      {
        kind: "MILD",
        items: [
          ["Na'vi River Journey"],
          ["Kali River Rapids", "Juego de agua: se mojan"],
          ["Zootopia: Better Zoogether!", "Show 4D"],
          ["Gorilla Falls Exploration Trail", "Sendero de animales"],
          ["Maharajah Jungle Trek", "Sendero de animales"],
          ["Discovery Island Trails"],
          ["The Oasis Exhibits"],
        ],
      },
      {
        kind: "SHOWS",
        title: "Shows de Animal Kingdom",
        items: [
          ["Festival of the Lion King", "África · Acrobacias, artistas en vivo y Hakuna Matata", "Varias funciones"],
          ["Finding Nemo: The Big Blue… and Beyond!", "Musical con marionetas", "Varias funciones"],
          ["Feathered Friends in Flight!", "Asia · Educativo, con vistas hermosas", "Varias funciones"],
        ],
      },
      {
        kind: "CHARACTERS",
        title: "Personajes en Animal Kingdom",
        items: [
          ["Mickey y Minnie", "Con trajes de exploradores en Adventurers Outpost"],
          ["Moana", "En el Árbol de la Vida"],
          ["Pocahontas", "The Oasis"],
          ["Kevin, Jane, Timón y Rafiki", "Paseando por el parque"],
        ],
      },
      {
        kind: "DINING",
        title: "Dónde comer (quick service)",
        items: [
          ["Satu'li Canteen", "Pandora · Abundante y sabroso"],
          ["Pongu Pongu", "Pandora · Snacks y bebidas divertidas"],
          ["Flame Tree Barbecue", "Opciones ahumadas riquísimas"],
          ["Pizzafari", "África · Pizzas clásicas"],
          ["Yak & Yeti Local Food Cafes", "Asia · Pollo con miel, bowls teriyaki"],
        ],
        note: QUICK_TIP,
      },
      {
        kind: "TIPS",
        items: [
          ["Arrancar según la espera en Avatar Flight of Passage."],
          ["El safari es mejor a la mañana: los animales están más activos."],
          ["Usar single rider en Expedition Everest si hay mucha gente."],
          ["Pensar el horario del Rey León para no perdérselo."],
          ["Comer en Pandora o en Flame Tree Barbecue."],
          ["Disfrutar de la naturaleza y buscar a los animales en los senderos."],
        ],
      },
    ],
  },

  // ─── Universal Orlando ─────────────────────────────────────────────────────
  {
    kind: "PARK",
    destination: "UNIVERSAL_ORLANDO",
    name: "Universal Studios Florida",
    aliases: ["Universal Studios", "USF", "US"],
    openTime: "09:00",
    closeTime: "21:00",
    hoursNote: HOURS_NOTE,
    arrival: "1 hora antes de la apertura",
    mainShow: "The Bourne Stuntacular · Varias funciones",
    sections: [
      {
        kind: "AREA",
        title: "Harry Potter: Diagon Alley",
        items: [
          ["Harry Potter and the Escape from Gringotts", "Montaña rusa intensa y simulador 3D"],
          ["Hogwarts Express", "Tren a Islands of Adventure (con park to park)"],
          ["El dragón de Gringotts", "Spot de fotos: tira fuego cada 10 a 15 min"],
        ],
      },
      {
        kind: "MUST_DO",
        title: "Hollywood, Nueva York y San Francisco",
        items: [
          ["Revenge of the Mummy", "Montaña rusa intensa"],
          ["Transformers: The Ride-3D", "Simulador 3D"],
          ["Race Through New York Starring Jimmy Fallon", "Simulador 3D"],
          ["Men in Black: Alien Attack", "Carrito con pistolas"],
        ],
      },
      {
        kind: "AREA",
        title: "Minion Land y Springfield",
        items: [
          ["Despicable Me Minion Mayhem", "Simulador 3D"],
          ["Illumination's Villain-Con Minion Blast", "Paseo con pistolas"],
          ["The Simpsons Ride", "Simulador"],
          ["Kang & Kodos' Twirl 'n' Hurl", "Similar a Dumbo"],
        ],
        note: "En Springfield se puede comprar la dona gigante en Kwik-E-Mart.",
      },
      {
        kind: "SHOWS",
        title: "Los mejores shows",
        items: [
          ["The Bourne Stuntacular", "Acción y acrobacias con tecnología nueva", "Varias funciones"],
          ["Animal Actors on Location!", "Los protagonistas son los animales", "Varias funciones"],
        ],
      },
      {
        kind: "CHARACTERS",
        items: [["Shrek y Burro", "DreamWorks Land: foto e interacción con Burro"]],
      },
      {
        kind: "DINING",
        items: [
          ["Leaky Cauldron", "Harry Potter · Porciones abundantes"],
          ["Florean Fortescue's Ice-Cream Parlour", "Heladería temática de Harry Potter"],
          ["Krusty Burger y Moe's Tavern", "Springfield · Patio de comidas"],
          ["Richter's Burger Co.", "Muy buenas hamburguesas"],
          ["Mel's Drive-In", "Hollywood · Típico diner americano"],
          ["Lombard's Seafood Grille", "San Francisco · Pescados y cócteles"],
        ],
        note: QUICK_TIP,
      },
      {
        kind: "TIPS",
        items: [
          ["Con park to park, después de recorrer el parque vuelvan a Harry Potter para tomar el tren a Islands of Adventure: es una atracción en sí."],
          ["Llevar mochilas chicas o riñoneras: en las montañas rusas hay lockers obligatorios."],
          ["Las entradas impresas se retiran en el visitor center; sacarles foto y escanearlas en la app."],
        ],
      },
    ],
  },
  {
    kind: "PARK",
    destination: "UNIVERSAL_ORLANDO",
    name: "Islands of Adventure",
    aliases: ["IOA", "Universal's Islands of Adventure"],
    openTime: "09:00",
    closeTime: "21:00",
    hoursNote: HOURS_NOTE,
    arrival: "1 hora antes de la apertura",
    sections: [
      {
        kind: "AREA",
        title: "Para arrancar el día: Harry Potter",
        items: [
          ["Hagrid's Magical Creatures Motorbike Adventure", "Montaña rusa intensa"],
          ["Harry Potter and the Forbidden Journey", "Simulador"],
          ["Shows de Hogwarts", "Coro de ranas y bailarinas", "Varias funciones"],
        ],
        note: "Comer en Las Tres Escobas, pasear por las tiendas y sacarse la foto con el castillo.",
      },
      {
        kind: "AREA",
        title: "Marvel Super Hero Island",
        items: [
          ["The Incredible Hulk Coaster", "Montaña rusa súper intensa"],
          ["The Amazing Adventures of Spider-Man", "Simulador"],
          ["Doctor Doom's Fearfall", "Caída libre"],
        ],
      },
      {
        kind: "AREA",
        title: "Jurassic Park",
        items: [
          ["Jurassic World VelociCoaster", "Montaña rusa súper intensa"],
          ["Jurassic Park River Adventure", "Paseo con caída"],
          ["Raptor Encounter", "Foto con Blue: chequear el horario desde las 10"],
        ],
        note: "No subir con nada suelto a la VelociCoaster.",
      },
      {
        kind: "AREA",
        title: "Seuss Landing y Toon Lagoon",
        items: [
          ["Popeye & Bluto's Bilge-Rat Barges", "Juego de agua: se empapan"],
          ["Dudley Do-Right's Ripsaw Falls", "Juego de agua: se empapan"],
          ["The Cat in the Hat y One Fish, Two Fish", "Juegos infantiles clásicos"],
        ],
        note: "Los juegos de agua conviene hacerlos temprano o llevar ropa para cambiarse.",
      },
      {
        kind: "DINING",
        items: [
          ["Three Broomsticks", "Harry Potter · Opciones completas y abundantes"],
          ["Thunder Falls Terrace", "Jurassic Park · Carne asada en porciones abundantes"],
          ["Cinnabon", "Port of Entry · Los mejores rolls de canela"],
        ],
        note: QUICK_TIP,
      },
      {
        kind: "TIPS",
        items: [
          ["Si tienen early entry, empiecen por Harry Potter."],
          ["Desayunar en Las Tres Escobas."],
          ["Llevar mochilas chicas o riñoneras: ojo con los lockers y las cosas sueltas en las montañas rusas."],
        ],
      },
    ],
  },
  {
    kind: "PARK",
    destination: "UNIVERSAL_ORLANDO",
    name: "Epic Universe",
    aliases: ["Epic", "Universal Epic Universe"],
    openTime: "09:00",
    closeTime: "21:00",
    hoursNote: HOURS_NOTE,
    arrival: "1 hora antes de la apertura",
    mainShow: "Celestial Goodnight",
    sections: [
      {
        kind: "AREA",
        title: "Harry Potter: Ministry of Magic",
        items: [
          ["Harry Potter and the Battle at the Ministry", "Simulador 3D"],
          ["Le Cirque Arcanus", "Show de circo mágico", "Varias funciones"],
          ["Café L'Air De La Sirène", "Cafetería francesa para desayunar"],
        ],
      },
      {
        kind: "AREA",
        title: "Super Nintendo World",
        items: [
          ["Mine-Cart Madness", "Montaña rusa de Donkey Kong"],
          ["Mario Kart: Bowser's Challenge", "Simulador 3D"],
          ["Yoshi's Adventure", "Paseo familiar"],
        ],
      },
      {
        kind: "AREA",
        title: "Isle of Berk",
        items: [
          ["Hiccup's Wing Gliders", "Montaña rusa"],
          ["Dragon Racer's Rally", "Giros intensos"],
          ["Fyre Drill", "Paseo en barco con agua"],
          ["Encuentro con Chimuelo e Hipo", "¡Se puede acariciar a Chimuelo!"],
        ],
      },
      {
        kind: "AREA",
        title: "Dark Universe",
        items: [
          ["Monsters Unchained: The Frankenstein Experiment", "Simulador 3D"],
          ["Curse of the Werewolf", "Montaña rusa con giros"],
          ["El molino en llamas", "Se prende a los minutos 13, 33 y 53 de cada hora"],
        ],
      },
      {
        kind: "AREA",
        title: "Celestial Park",
        items: [
          ["Stardust Racers", "Montaña rusa súper intensa"],
          ["Constellation Carousel", "Carrusel"],
          ["Celestial Goodnight", "Show de luces y fuentes en la laguna central, a la noche"],
          ["Helios Grand Hotel", "Para pasear y conocer"],
        ],
      },
      {
        kind: "DINING",
        items: [
          ["The Blue Dragon Pan-Asian Restaurant", "Celestial Park · Requiere reserva: ramen y fideos con camarones"],
          ["Atlantic", "Celestial Park · Mariscos, propuesta elevada"],
          ["Das Stakehaus", "Dark Universe · Cortes de carne, estilo gótico alemán"],
          ["Toadstool Cafe", "Super Nintendo World · El más divertido: hamburguesas y sopa de hongos"],
          ["Mead Hall", "Isle of Berk · Banquete vikingo abundante"],
        ],
      },
      {
        kind: "SNACKS",
        title: "Snacks épicos",
        items: [
          ["Yoshi's Red Shell Calzone", "Yoshi's Snack Island"],
          ["DK Crush Float", "The Bubbly Barrel"],
          ["Crêpe de cerveza de manteca", "Ministry of Magic"],
          ["Helado de cookie butter con estrellas", "Frosty Moon"],
          ["Cono de mac and cheese", "Hooligan's Grog & Gruel"],
        ],
      },
      {
        kind: "TIPS",
        items: [
          ["Es el parque más nuevo de Orlando: llegar temprano y arrancar por la zona que más les interese."],
          ["Quedarse a la noche para ver Celestial Goodnight y el parque iluminado."],
        ],
      },
    ],
  },

  // ─── Eventos especiales ────────────────────────────────────────────────────
  {
    kind: "EVENT",
    destination: "DISNEY_WORLD",
    name: "Mickey's Not-So-Scary Halloween Party",
    park: "Magic Kingdom",
    aliases: ["Not So Scary", "Halloween Party", "Fiesta de Halloween", "MNSSHP"],
    openTime: "19:00",
    closeTime: "00:00",
    hoursNote: "Con la entrada de la fiesta se puede ingresar desde las 16:00. Esas noches el parque cierra antes para el público general.",
    arrival: "16:00 (ingreso con la entrada de la fiesta)",
    mainShow: "Fuegos artificiales de Halloween",
    sections: [
      {
        kind: "SHOWS",
        title: "Imperdibles de la fiesta",
        items: [
          ["Mickey's Boo-to-You Halloween Parade", "Desfile exclusivo de la fiesta", "Dos funciones"],
          ["Disney's Not-So-Spooky Spectacular", "Fuegos artificiales de Halloween"],
          ["Hocus Pocus Villain Spelltacular", "Show de villanos frente al castillo", "Varias funciones"],
        ],
        note: "La segunda función del desfile suele tener menos gente.",
      },
      {
        kind: "CHARACTERS",
        items: [
          ["Personajes con disfraces de Halloween", "Solo durante la fiesta"],
          ["Jack Skellington y Sally", "Encuentro especial de la fiesta"],
          ["Villanos", "Por todo el parque"],
        ],
        note: "Las filas de personajes se cortan temprano: elegir uno o dos y llegar con tiempo.",
      },
      {
        kind: "OTHER",
        title: "Caramelos y extras",
        items: [
          ["Treat Trails", "Puestos de caramelos por todo el parque, incluidos en la entrada"],
          ["Snacks y bebidas de temporada", "Solo durante la fiesta"],
        ],
      },
      {
        kind: "MILD",
        title: "Atracciones abiertas durante la fiesta",
        items: [
          ["La mayoría de las atracciones", "Con menos espera que en un día común"],
          ["Haunted Mansion", "Ideal para la noche de Halloween"],
        ],
      },
      {
        kind: "TIPS",
        items: [
          ["Llegar a las 16:00 para aprovechar las atracciones antes de que empiece la fiesta."],
          ["Se puede ir disfrazado: revisar las reglas de disfraces de Disney (los adultos no pueden usar máscaras)."],
          ["Llevar una bolsa o mochila para los caramelos."],
          ["Ubicarse con tiempo para el desfile y los fuegos."],
        ],
      },
    ],
  },
  {
    kind: "EVENT",
    destination: "DISNEY_WORLD",
    name: "Mickey's Very Merry Christmas Party",
    park: "Magic Kingdom",
    aliases: ["Very Merry", "Christmas Party", "Fiesta de Navidad", "MVMCP"],
    openTime: "19:00",
    closeTime: "00:00",
    hoursNote: "Con la entrada de la fiesta se puede ingresar desde las 16:00. Esas noches el parque cierra antes para el público general y no hay Disney Starlight.",
    arrival: "16:00 (ingreso con la entrada de la fiesta)",
    mainShow: "Fuegos artificiales navideños",
    sections: [
      {
        kind: "SHOWS",
        title: "Imperdibles de la fiesta",
        items: [
          ["Mickey's Once Upon a Christmastime Parade", "Desfile exclusivo de la fiesta", "Dos funciones"],
          ["Minnie's Wonderful Christmastime Fireworks", "Fuegos artificiales navideños"],
          ["Shows navideños frente al castillo", "Varias funciones"],
        ],
      },
      {
        kind: "CHARACTERS",
        items: [
          ["Personajes con ropa navideña", "Solo durante la fiesta"],
          ["Santa Claus", "Encuentro especial de la fiesta"],
        ],
      },
      {
        kind: "OTHER",
        title: "Extras de la fiesta",
        items: [
          ["Galletitas y chocolate caliente", "Incluidos en la entrada"],
          ["Nieve en Main Street", "Después del desfile y los fuegos"],
        ],
      },
      {
        kind: "TIPS",
        items: [
          ["Llegar a las 16:00 para aprovechar las atracciones antes de la fiesta."],
          ["Las fechas se agotan rápido: confirmar la disponibilidad antes de prometerla."],
          ["Abrigarse: las noches de diciembre pueden ser frescas."],
        ],
      },
    ],
  },
  {
    kind: "EVENT",
    destination: "DISNEY_WORLD",
    name: "Disney Jollywood Nights",
    park: "Hollywood Studios",
    aliases: ["Jollywood"],
    hoursNote: "Fiesta nocturna con entrada aparte. Verificar el horario de la noche: el parque puede cerrar antes para el público general.",
    sections: [
      {
        kind: "SHOWS",
        title: "Imperdibles de la fiesta",
        items: [["Shows navideños exclusivos de la fiesta", "Varias funciones"]],
      },
      {
        kind: "CHARACTERS",
        items: [["Personajes con ropa de fiesta", "Solo durante el evento"]],
      },
      {
        kind: "TIPS",
        items: [["Revisar en la app el horario y el mapa de la noche."], ["Llegar con tiempo para los shows más buscados."]],
      },
    ],
  },
  {
    kind: "EVENT",
    destination: "UNIVERSAL_ORLANDO",
    name: "Halloween Horror Nights",
    park: "Universal Studios Florida",
    aliases: ["HHN", "Horror Nights"],
    openTime: "18:30",
    closeTime: "02:00",
    hoursNote: "Se puede entrar al parque antes con la entrada regular.",
    arrival: "1 hora antes de la apertura de la fiesta",
    sections: [
      {
        kind: "MUST_DO",
        title: "Casas de terror prioritarias",
        items: [["Stranger Things"], ["Sinners"], ["Jack & Oddfellow: Chaos y Control"], ["Ozzy Osbourne: Prince of Darkness"], ["Hellraiser y Evil Dead Burn"]],
      },
      {
        kind: "AREA",
        title: "Zonas de terror",
        items: [["Infernal Carnival of Nightmares"], ["Sideshow of Decay"], ["Fortnitemares"], ["Downtown Clowntown"]],
      },
      {
        kind: "SHOWS",
        title: "Shows imperdibles",
        items: [
          ["Stranger Things: Return to Hawkins", "Proyecciones sobre el agua en la laguna", "Desde las 21:00"],
          ["Nightmare Fuel: Blood Noir", "World Expo", "Desde las 20:00"],
          ["Encuentro con los mortífagos", "Harry Potter"],
        ],
      },
      {
        kind: "MILD",
        title: "Atracciones abiertas durante la fiesta",
        items: [["Revenge of the Mummy"], ["Transformers: The Ride-3D"], ["Harry Potter and the Escape from Gringotts"], ["Men in Black: Alien Attack"]],
        note: "Si hay alguna atracción que quieran hacer sí o sí, háganla temprano.",
      },
      {
        kind: "TIPS",
        title: "Tips para disfrutar Halloween Horror Nights",
        items: [
          ["Llegar por lo menos 1 hora antes de la apertura de la fiesta."],
          ["Quedarse hasta el cierre: las últimas dos horas son ideales para las casas más populares."],
          ["Cenar temprano para aprovechar después."],
          ["En las scare zones, no mostrar miedo: ¡serás el blanco principal!"],
          ["Los actores nunca tocan a los visitantes, y los visitantes no pueden tocar a los actores."],
          ["Intercalar casas con scare zones y shows para descansar."],
        ],
      },
    ],
  },
];
