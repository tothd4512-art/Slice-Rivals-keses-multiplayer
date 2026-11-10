// Standalone LAN/online server entry. Run: npm run build && npm run server
// Environment: PORT (default 8787), HOST (default 0.0.0.0)
import { startGameServer } from './core.js';

// Last line of defence: an unexpected error is logged and the server keeps serving the other players
process.on('uncaughtException', (err) => console.error('Váratlan hiba (a szerver fut tovább):', err));
process.on('unhandledRejection', (err) => console.error('Kezeletlen Promise-hiba (a szerver fut tovább):', err));

startGameServer({
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '0.0.0.0'
}).catch((err) => {
  console.error('A szerver nem indult el:', err.message);
  process.exit(1);
});
