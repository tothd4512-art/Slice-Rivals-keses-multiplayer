// Entry point: open the IndexedDB save first, then start the game.
import { initStorage } from './storage.js';

initStorage().then(() => import('./main.js'));
