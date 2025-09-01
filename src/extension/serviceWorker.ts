console.log('Service worker loaded'); self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) });
