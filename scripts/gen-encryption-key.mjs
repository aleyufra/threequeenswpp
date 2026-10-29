import crypto from 'node:crypto';

// Generar una clave aleatoria de 32 bytes (256 bits) para AES-256
const key = crypto.randomBytes(32).toString('hex');

console.log('Clave de cifrado generada (hex):');
console.log(key);