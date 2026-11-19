// Red primero, caché de respaldo: con señal siempre se ven los horarios nuevos y sin señal abre la última versión vista.
const CACHE = "cartelera-v1"

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((nombre) => nombre !== CACHE).map((nombre) => caches.delete(nombre))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (evento) => {
  const { request } = evento
  // Solo GET del propio sitio: las tipografías y los pósters de los cines no se guardan.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return
  evento.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copia))
        }
        return respuesta
      })
      .catch(async () => (await caches.match(request)) ?? (request.mode === "navigate" ? caches.match("./") : Response.error())),
  )
})
