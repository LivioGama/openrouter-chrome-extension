console.log('Service worker loaded');
(self as any).addEventListener('activate', (event: any) => {
  event.waitUntil((self as any).clients.claim())
})
